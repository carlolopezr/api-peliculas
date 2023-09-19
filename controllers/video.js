const fs = require('fs');
const { Storage } = require("@google-cloud/storage");
const { request, response } = require("express");
const path = require('path');
const getResolution = require('../helpers/getResolution');

const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS, "base64").toString()
);

const storageClient = new Storage({
  projectId: 'cine-independiente-398119',
  credentials
});

const bucketName = 'peliculas_cineindependiente';

const postVideo = async (req = request, res = response) => {

  const  { id } = req.query
  
  try {
    const {email='prueba@pruebacineindependiente.cl', title="Dota 2 THE MOVIE"} = req.body

    if (!req.file) {
      return res.status(400).json({
        msg: "Falta el archivo de video"
      });
    }

    const pathToFile = req.file.path;
    const resolution = await getResolution(pathToFile) 

    // console.log(req.file.mimetype);

    // const videoComprimido = await encode(pathToFile,outputPath )
    // console.log(videoComprimido);

    // Leer el contenido del archivo
    fs.readFile(pathToFile, (err, data) => {
      if (err) {
        console.error('Error al leer el archivo:', err);
        return res.status(500).json({
          msg: 'Error al leer el archivo'
        });
      }

      // Subir el archivo a Google Cloud Storage
      const bucket = storageClient.bucket(bucketName);
      
      const pathCloudStorage = `${email}/${title}/${resolution.height}/${path.basename(pathToFile)}`
      const videoFile = bucket.file(pathCloudStorage);

      const fileStream = videoFile.createWriteStream({
        metadata: {
          contentType: req.file.mimetype
        }
      });

      fileStream.on('error', (err) => {
        console.error('Error al subir el archivo:', err);
        return res.status(500).json({
          msg: 'Error al subir el archivo'
        });
      });

      fileStream.on('finish', () => {
        // fs.unlink(videoComprimido, (unlinkErr) => {
        //     if (unlinkErr) {
        //       console.error('Error al eliminar el archivo local:', unlinkErr);
        //     }
        // });
        return res.status(200).json({
          msg: 'Video subido con éxito',
          email,
          id,
          title,
          resolution
        });
      });

      fileStream.end(data);
    });

  } catch (error) {

    console.error('Error en la carga del video:', error);

    res.status(500).json({
      msg: 'Error en la carga del video'
    });

  }
};


const encode = async(req = request, res = response)=> {

  const {filename, id, resolution } = req.body
  const {height} = resolution


  
} 


module.exports = {
  postVideo,
  encode
};
