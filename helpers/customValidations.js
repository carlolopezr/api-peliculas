
const checkFileType = (file, cb) => {
    const supportedVideoTypes = ['video/mp4','video/quicktime','video/x-msvideo', 'video/x-matroska'];
    const mimetype = supportedVideoTypes.includes(file.mimetype);

    if (!mimetype) {
      cb(new Error(`El formato del archivo no es soportado '${file.mimetype}' Formatos soportados: MP4/AVI/MOV/MKV`));
    }
    else {
        cb(null, true)
    }
}

module.exports = {
    checkFileType
}