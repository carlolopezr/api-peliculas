const ffmpeg = require('fluent-ffmpeg');

const getResolution = (path) => {
    return new Promise((resolve, reject) => {
        try {
            ffmpeg.ffprobe(path, (err, metadata) => {
                if (err) reject(err)
        
                const {width, height} = metadata.streams[0]
                const duration = metadata.format.duration;
                const size = metadata.format.size
                resolve ({
                    width:width,
                    height:height,
                    duration:duration,
                    size:size
                })
            })
        } catch (error) {
            reject(error)
        }   
    }) 
}


module.exports = getResolution