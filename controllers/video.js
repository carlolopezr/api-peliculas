const fs = require('fs');
const { Storage } = require("@google-cloud/storage");
const { request, response } = require("express");
const { encode } = require('../helpers/encode');
const path = require('path');

const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS, "base64").toString()
);

const storageClient = new Storage({
  projectId: 'cine-independiente-398119',
  credentials
});

const bucketName = 'peliculas_cineindependiente';

const postVideo = async (req = request, res = response) => {
  try {

    const {id, email} = req.body

    if (!req.file) {
      return res.status(400).json({
        msg: "Falta el archivo de video"
      });
    }

    const pathToFile = req.file.path;
    const outputPath = "C:\\Users\\Carlos\\Desktop\\api-peliculas\\videosStorage\\"+"comprimido_" +req.file.filename 

    const videoComprimido = await encode(pathToFile,outputPath )
    console.log(videoComprimido);

    // Leer el contenido del archivo
    fs.readFile(videoComprimido, (err, data) => {
      if (err) {
        console.error('Error al leer el archivo:', err);
        return res.status(500).json({
          msg: 'Error al leer el archivo'
        });
      }

      // Subir el archivo a Google Cloud Storage
      const bucket = storageClient.bucket(bucketName);
    
      const videoFile = bucket.file(path.basename(videoComprimido));

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
        fs.unlink(videoComprimido, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Error al eliminar el archivo local:', unlinkErr);
            }
        });
        return res.status(200).json({
          msg: 'Video subido con éxito'
        });
      });

      // Escribir el contenido del archivo en el flujo de escritura
      fileStream.end(data);
    });

  } catch (error) {

    console.error('Error en la carga del video:', error);

    res.status(500).json({
      msg: 'Error en la carga del video'
    });

  }
};

module.exports = {
  postVideo
};
