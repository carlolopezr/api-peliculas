const ffmpeg = require('fluent-ffmpeg');

const encode = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('192k')
      .outputOptions('-crf 23')
      .output(outputPath)
      .on('end', () => {
        console.log('Compresión completada');
        resolve(outputPath); // Resuelve la promesa con la ruta del archivo comprimido
      })
      .on('error', (err) => {
        console.error('Error en la compresión:', err);
        reject(err); // Rechaza la promesa si hay un error
      })
      .run();
  });
};

module.exports = {
  encode
};
