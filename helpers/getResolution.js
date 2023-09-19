const ffmpeg = require('fluent-ffmpeg');

const getResolution = (path) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(path, (err, metadata) => {
            if (err) reject(err)
    
            const {width, height} = metadata.streams[0]
            resolve ({
                width,
                height
            })
        })
    }) 
}


module.exports = getResolution