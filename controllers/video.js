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

const encode = async (req = request, res = response, next) => {
  const outputs = [];
  const resolutions = [
    { width: 3840, height: 2160, videoBitrate: '15000k' },
    { width: 2048, height: 1080, videoBitrate: '5000k' },
    { width: 1280, height: 720, videoBitrate: '2000k' },
    { width: 720, height: 480, videoBitrate: '1500k' },
    { width: 640, height: 360, videoBitrate: '1000k' },
  ];

  try {
    const { inputPath, date, user_id } = req.data;
    const originalResolution = await getResolution(inputPath);
    const inputPathInfo = path.parse(inputPath);
    
    for (const resolution of resolutions) {
      if (
        resolution.width <= originalResolution.width &&
        resolution.height <= originalResolution.height
      ) {
        const outputPath = path.join(
          inputPathInfo.dir,
          `${resolution.height}`,
          path.basename(inputPath)
        );

        // Verificar si la carpeta `resolution.height` existe
        const folderPath = path.join(inputPathInfo.dir, `${resolution.height}`);
        if (!fs.existsSync(folderPath)) {
          // Si no existe, crearla
          fs.mkdirSync(folderPath, { recursive: true });
        }

        await new Promise((resolve, reject) => {
          const ffmpegProcess = ffmpeg(inputPath)
            .videoCodec('h264_amf')
            .videoBitrate(resolution.videoBitrate)
            .audioCodec('aac')
            .audioBitrate('192k')
            .outputOptions('-crf 23')
            .videoFilters(`scale=${resolution.width}:${resolution.height}`)
            .output(outputPath)
            .on('end', () => {
              console.log(`Compresión completada para ${resolution.width}x${resolution.height}`);
              resolve();
            })
            .on('error', (err) => {
              console.error(`Error en la compresión para ${resolution.width}x${resolution.height}:`, err);
              reject(err);
            })
        

          let paths = {
            outputPath: outputPath,
            width: resolution.width,
            height: resolution.height,
          };
          outputs.push(paths);
        })
      }
    }
   
    let data = {
        outputs: outputs,
        date: date,
        user_id:user_id,
      };

    req.data = data
    console.log('Conversiónes realizadas con éxito');
    next()
    
  } catch (error) {
    console.error(`Hubo un error al intentar realizar la compresión: ${error}`);
  }
};

const videoDetection = async (req=request, res=response, next) => {
  
  const {gcsUri, user_id, date} = req.data
  if (!gcsUri) return console.error('Falta el link del video a Cloud Storage');
  
  try {
    const data = await videoDetectionService(gcsUri)
    console.log(data);
    if (!data.containsExplicitContent) {
      console.log('Video sin contenido explicito');
      
    } else {
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
    if (!outputs) return console.error('Faltan los outputs en la solicitud');

    const folderPath = `uploads/${user_id}/${date}`
    const promises = [];

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
          }).then((data) => {
            console.log(data[0].metadata.mediaLink);
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
          
          const datos = {
            date:date,
            user_id:user_id,
            data: {
              movieUrl:movieUrl
            }
          }

          updateMovie(datos) 
        })
      .catch((error) => {
          console.error('Error al cargar los videos:', error);
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
    { width: 1280, height: 720, videoBitrate: '2000k' },
    { width: 720, height: 480, videoBitrate: '1500k' },
    { width: 640, height: 360, videoBitrate: '1000k' },
  ];

  try {
    const { inputPath, date, user_id } = req.data;
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
              reject(err);
            })
            .run();
        });
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

    // const apiUrl = 'https://server-cine-independiente.vercel.app/api/movie';
    const apiUrl = 'http://localhost:3000/api/movie/update-movie'
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

    console.log(response.data);

  } catch (error) {
    
    console.log('Error al actualizar película:', error);
  }
}

module.exports = {
  postVideoOnServer,
  postVideoOnCloudStorage,
  encode,
  videoDetection,
  uploadImageToServer,
  uploadImageToCloudinary,
  generateHLS,
  updateMovie
};
