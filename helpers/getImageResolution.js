const sizeOf = require('image-size')

const getImageResolution = (path) => {

    return new Promise((resolve, reject) => {
        try {
            const dimensions = sizeOf(path)
            resolve(dimensions)
        } catch (error) {
            reject(error)
        }
    })
}


module.exports = getImageResolution