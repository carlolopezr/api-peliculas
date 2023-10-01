const fs = require('fs');
const { Storage } = require("@google-cloud/storage");
const { request, response } = require("express");
const cloudinary = require('cloudinary').v2;
const path = require('path');
const busboy = require('busboy');
const { checkFileType } = require('../helpers/customValidations');
const ffmpeg = require('fluent-ffmpeg');
const getResolution = require('../helpers/getResolution');
const { videoDetectionService } = require('../services/videoDetectionService');
const axios = require('axios');

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS, "base64").toString()
);

const storage = new Storage({
  projectId: 'cine-independiente-398119',
  credentials
});

const bucketName = 'peliculas_cineindependiente';
const bucket = storage.bucket(bucketName);

const postVideoOnServer = async (req=request, res=response, next) => {
	const bb = busboy({ headers: req.headers });
  
  const id = req.query.id
  const date = req.query.date

	let filePath = ''
	let fileMimetype = '';
  const uploadDir = path.join(`./uploads/${id}/${date}`);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

	bb.on('file', (_, file, info) => {
		const fileName = info.filename;
		fileMimetype = info.mimeType;

    try {
      checkFileType(fileMimetype)
    } catch (error) {
      
      return res.status(400).json({
        msg:error.message
      })
    }
    const uniqueFileName = `${id}_${date}.mp4`
    filePath = path.join(uploadDir, uniqueFileName);
		const stream = fs.createWriteStream(filePath);

    file.on('error', (err) => {
      res.status(400).json({
        msg: `Hubo un error al cargar el archivo ${fileName}: ${err}`
      })
    });

		file.pipe(stream);
    
	});

  bb.on('field', (fieldname, val) => {
    if (fieldname == 'email') {
      const email = val;
      req.email = email
    }
  })

	bb.on('close', async () => {
    let data = {
      inputPath: filePath,
      user_id:id,
      date:date
    }
    req.data = data
		res.status(200).json({ 
      msg: 'Video subido con éxito',
      
    });
    next()
	});

  bb.on('error', (error) => {
    res.status(400).json({
      msg: `Hubo un error al cargar el video: ${error}`
    })
  })
  
	req.pipe(bb);
	return;
};

const videoDetection = async (req=request, res=response, next) => {
  
  const {gcsUri, user_id, date} = req.data
  const {email} = req.email
  if (!gcsUri) return console.error('Falta el link del video a Cloud Storage');
  
  try {
    const data = await videoDetectionService(gcsUri)
      .catch((err) => {
        const datos = {
          email:email,
          subject:`Error al intentar realizar la detección de contenido explícito`,
          text:`Hubo un error inesperado al intentar realizar la detección de contenido explícito 
          por favor vuelva a intentarlo nuevamente más tarde. 
          Error: ${err}`
        }
        sendNotificationEmail(datos)
      })
    console.log(data);
    if (!data.containsExplicitContent) {
      const datos = {
        date:date,
        user_id:user_id,
        data: {
          explicitContent: false
        }
      }

      await updateMovie(datos)
      console.log('Video sin contenido explicito');
      
    } else {
      const datos = {
        date:date,
        user_id:user_id,
        data: {
          explicitContent: true
        }
      }

      await updateMovie(datos)
      console.log(`El video contienede contenido explicito: ${data.explicitContentTimes}`);

    }
    next()
  } catch (error) {
    return console.error('Hubo un error al intentar realizar la detección de contenido explícito')
  }  
}

const postVideoOnCloudStorage = async (req=request, res=response, next) => {
  try {
    const { user_id, outputs, date } = req.data;
    const email = req.email
    console.log(email);
    if (!outputs) return console.error('Faltan los outputs en la solicitud');

    const folderPath = `uploads/${user_id}/${date}`
    const promises = [];
    const errors = [];

    const items = fs.readdirSync(folderPath)

    for(const item of items) {
      const itemPath = path.join(folderPath, item)
      const isDirectory = fs.statSync(itemPath).isDirectory();

      if (isDirectory) {
        
        const subItems = fs.readdirSync(itemPath);
        const itemPathName = path.basename(itemPath)

        for(const subItem of subItems) {
          const subItemPath = path.join(itemPath, subItem)
          const subItemPathName = path.basename(subItemPath)

          const cloudStoragePath = `${user_id}/${date}/${itemPathName}/${subItemPathName}`

          bucket.upload(subItemPath, {
            destination:cloudStoragePath
          })
          .catch((err) => {
            const datos = {
              email:email,
              subject:`Error al subir el video a Cloud Storage`,
              text:`Hubo un error inesperado al intentar subir su película a Cloud Storage por favor vuelva a intentarlo nuevamente más tarde
              Error: ${err}`
            }
            sendNotificationEmail(datos)
          })

        }
      }
      else {
        const uploadPromise = bucket.upload(itemPath, {
          destination: `${user_id}/${date}/${path.basename(itemPath)}`
        }).then((data) => {

          const files = data[0]
          return files.metadata
        })
        .catch((err) => {
          const datos = {
            email:email,
            subject:`Error al subir el video a Cloud Storage`,
            text:`Hubo un error inesperado al intentar subir su película a Cloud Storage por favor vuelva a intentarlo nuevamente más tarde
            Error: ${err}`
          }
          sendNotificationEmail(datos)
        })

        promises.push(uploadPromise)
      }
    }

    let data = {}

    Promise.all(promises)
      .then((metadata) => {
          const gcsUri = `gs://${metadata[0].bucket}/${metadata[0].name}`;
          const movieUrl = `${metadata[0].bucket}/${user_id}/${date}`
          data = {
            gcsUri:gcsUri,
            user_id:user_id,
            date:date,
            movieUrl:movieUrl
          }
          
          //Actualizar URL de la película
          const datos = {
            date:date,
            user_id:user_id,
            data: {
              movieUrl:movieUrl
            }
          }

          updateMovie(datos)
            .then(() => {
              console.log('Película actualizada correctamente');
              next()
            })
            .catch((err) => {
              console.log('hubo un error al intentar actualizar el URL de la película:', err);
              deleteFilesInBucket(user_id, date)
                .then(() => {
                  console.log('Película eliminada con éxito');
                  return
                })
                .catch(() => {
                  console.log('Error al intentar eliminar archivos');
                  return
                })

            })
        })
        .catch((err) => {
          const datos = {
            email:email,
            subject:`Error al subir el video a Cloud Storage`,
            text:`Hubo un error inesperado al intentar subir su película a Cloud Storage por favor vuelva a intentarlo nuevamente más tarde
            Error: ${err}`
          }
          sendNotificationEmail(datos)
        })
      .finally(() => {
          req.data = data
          console.log('Video subido con éxito a Cloud Storage');
          next()
    });


  } catch (error) {
    console.error('Error en la carga del video:', error);
  }
};

const uploadImageToServer = async (req, res, next) => {
	const bb = busboy({ headers: req.headers });
	req.userId = req.query.id;

	if (!req.query.id) {
		return res.status(400).json({
			msg: 'No hay id de usuario',
		});
	}
	bb.on('field', (fieldname, val) => {
		req[fieldname] = val;
	});

	bb.on('file', async (_, file, info) => {
		const fileName = path.parse(info.filename);
		const filePath = `./uploads/${fileName.name}${req.query.id}${fileName.ext}`;
		req.filename = fileName.name;
		req.filePath = filePath;
		const stream = fs.createWriteStream(filePath);
		file.pipe(stream);
	});

	bb.on('close', () => {
		next();
	});
	req.pipe(bb);
};

const uploadImageToCloudinary = (req = request, res = response) => {
	cloudinary.uploader.upload(
		req.filePath,
		{ public_id: `${req.filename}${req.date}`, folder: `${req.userId}` },
		(error, result) => {
			if (error) {
				return res.status(500).json({
					msg: 'Error al subir la imagen',
					error,
				});
			}
			fs.unlinkSync(req.filePath);
			return res.status(201).json({
				imageUrl: result.secure_url,
			});
		}
	);
};

const generateHLS = async (req, res, next) => {
  const outputs = [];
  const resolutions = [
    { width: 3840, height: 2160, videoBitrate: '15000k' },
    { width: 2048, height: 1080, videoBitrate: '5000k' },
    { width: 1920, height: 1080, videoBitrate: '5000k' },
    { width: 1280, height: 720, videoBitrate: '2000k' },
    { width: 720, height: 480, videoBitrate: '1500k' },
    { width: 640, height: 360, videoBitrate: '1000k' },
  ];

  try {
    const { inputPath, date, user_id } = req.data;
    const email = req.email
    const originalResolution = await getResolution(inputPath);
    const inputPathInfo = path.parse(inputPath);

    for (const resolution of resolutions) {
      if (
        resolution.width <= originalResolution.width &&
        resolution.height <= originalResolution.height
      ) {
        const folderPath = path.join(inputPathInfo.dir, `${resolution.height}`);
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }

        const outputM3U8 = path.join(folderPath, `${user_id}_${date}.m3u8`);

        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .videoFilter(`scale=${resolution.width}:${resolution.height}`)
            .videoCodec('h264_amf')
            .addOption('-profile:v', 'main')
            .addOption('-level', '3.1')
            .addOption('-g', '48')
            .addOption('-keyint_min', '48')
            .addOption('-sc_threshold', '0')
            .addOption('-b:v', resolution.videoBitrate)
            .audioCodec('aac')
            .addOption('-b:a', '128k')
            .addOption('-hls_time', '4')
            .addOption('-hls_playlist_type', 'vod')
            .output(outputM3U8)
            .on('end', () => {
              console.log(`Transcoding complete for ${resolution.width}x${resolution.height}`);
              let paths = {
                outputPath: outputM3U8,
                width: resolution.width,
                height: resolution.height,
              };
              outputs.push(paths);
              resolve();
            })
            .on('error', (err) => {
              console.error(`Error: ${err.message}`);
              datos = {
                email:email,
                subject: 'Error al intentar procesar su video',
                text: `Ocurrio un error al intentar procesar su video con id: ${user_id}_${date}, por favor vuelva a intentarlo. 
                Error: ${err}`
              }
              sendNotificationEmail(datos)
              reject(err);
            })
            .run();
        })
        .catch((err) => {
          console.log(err);
        });
      }
      else{ 
        continue
      }
    }

    let data = {
      outputs: outputs,
      date: date,
      user_id: user_id,
    };

    req.data = data;
    console.log('Conversión realizada con éxito');
    next();
  } catch (error) {
    console.error(`Error generating HLS: ${error}`);
  }
};

const updateMovie = async(datos) => {
  try {

    const { date, user_id, data} = datos

    const apiUrl = `${process.env.API_SERVER}/movie/update-movie`
    // const apiUrl = 'http://localhost:3000/api/movie/update-movie'
    const request = {
      date:date,
      user_id:user_id,
      data: data
    }

    const config = {
      headers: {
        'Content-Type': 'application/json'
      },
    };

    const response = await axios.put(apiUrl, request, config)

    if (response.status==404) {
      throw new Error('Película no encontrada en la base de datos')
    }

  } catch (error) {
    
    console.log('Error al actualizar película:', error);
  }
}

const sendNotificationEmail = async(data) => {
  
  try {
    const {email, subject, text} = data
    const apiUrl = `${process.env.API_SERVER}/user/send-notification-email`
    // const apiUrl = `http://localhost:3000/api/user/send-notification-email`

    const request = {
      email:email,
      subject:subject,
      text:text
    }

    const config = {
      headers: {
        'Content-Type': 'application/json'
      },
    };
    const response = await axios.post(apiUrl, request, config)
    console.log(response.data);

  } catch (error) {
    console.log('Error al enviar el correo de notificación');
  }
}

const deleteFilesInBucket = async (user_id, date) => {

  const bucketPath = `${user_id}/${date}`;

  const [files] = await bucket.getFiles({ prefix: bucketPath });

  const deletePromises = files.map((file) => {
    return file.delete();
  });

  return Promise.all(deletePromises);
};

module.exports = {
  postVideoOnServer,
  postVideoOnCloudStorage,
  videoDetection,
  uploadImageToServer,
  uploadImageToCloudinary,
  generateHLS,
  updateMovie
};
