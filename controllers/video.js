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

const postVideoOnServer = async (req=request, res=response) => {
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
		res.status(200).json({ 
      msg: 'Video subido con éxito',
      data
    });
	});

  bb.on('error', (error) => {
    res.status(400).json({
      msg: `Hubo un error al cargar el video: ${error}`
    })
  })
  
	req.pipe(bb);
	return;
};

const encode = async (req=request, res=response) => {
  const outputs = [];
  const resolutions = [
    { width: 3840, height: 2160, videoBitrate: '15000k' },
    { width: 2048, height: 1080, videoBitrate: '5000k'},
    { width: 1280, height: 720, videoBitrate: '2000k' },
    { width: 720, height: 480, videoBitrate: '1500k' },
    { width: 640, height: 360, videoBitrate: '1000k'},
  ];

  try {
    const {inputPath,date, user_id} = req.body;
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
          ffmpeg(inputPath)
            .videoCodec('h264_amf')
            .videoBitrate(resolution.videoBitrate)
            .audioCodec('aac')
            .audioBitrate('192k')
            .outputOptions('-crf 23') // Ajusta el factor de calidad según tus necesidades
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
            .run();       
            let paths = {
              outputPath: outputPath,
              width: resolution.width,
              height: resolution.height
            }
            outputs.push(paths) 
        });
      }
    }

    let data = {
      outputs:outputs,
      date:date,
      user_id
    }

    res.status(200).json({
      msg:'Conversión realizada con éxito',
      data
    })
    
  } catch (error) {
    res.status(500).json({
      msg:`Hubo un error al intentar realizar la compresión del video: ${error}`
    })
  }
};

const videoDetection = async (req=request, res=response) => {
  
  const {gcsUri} = req.body
  if (!gcsUri) return res.status(400).json({msg: 'Falta la ruta al archivo'})
  
  try {
    const data = await videoDetectionService(gcsUri)
    console.log(data);
    if (!data.containsExplicitContent) {
      return res.status(200).json({
        msg:'Video sin contenido explícito'
      })
    }
  } catch (error) {
    return res.status(500).json({
      msg:'Hubo un error al intentar realizar la detección de contenido explícito'
    })  
  }

  
}

const postVideoOnCloudStorage = async (req=request, res=response) => {
  try {
    const { id } = req.query;
    const {outputs} = req.body
    const { date = '231534234' } = req.body
    if (!outputs) return res.status(400).json({msg: 'Falta la ruta al archivo'})


    const promises = [];
    outputs.forEach(output => {
      const pathCloudStorage = `${id}/${date}/${output.height}/${path.basename(output.outputPath)}`;
      const uploadPromise = bucket.upload(output.outputPath, {
        destination: pathCloudStorage
      }).then((data) => {
        const files = data[0];
        return files.metadata 
      })   

      promises.push(uploadPromise);
    })

    let data = {}

    Promise.all(promises)
      .then((metadata) => {
          const gcsUri = `gs://${metadata[metadata.length - 1].bucket}/${metadata[metadata.length - 1].name}`
          data = {
            gcsUri:gcsUri
          }   
        })
      .catch((error) => {
          console.error('Error al cargar los videos:', error);
        })
      .finally(() => {
        
          return res.status(200).json({
            msg: 'Videos subidos con éxito a Cloud Storage',
            data: data,
          });
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

module.exports = {
  postVideoOnServer,
  postVideoOnCloudStorage,
  encode,
  videoDetection,
  uploadImageToServer,
  uploadImageToCloudinary
};
