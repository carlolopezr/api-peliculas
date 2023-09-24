
const checkFileType = (mimeType) => {
    
    const supportedVideoTypes = ['video/mp4','video/quicktime','video/x-msvideo', 'video/x-matroska'];
    const isValid = supportedVideoTypes.includes(mimeType);

    if (!isValid) {
      throw new Error(`El formato del archivo no es soportado '${mimeType}' Formatos soportados: MP4/AVI/MOV/MKV`);
    }
}

module.exports = {
    checkFileType
}