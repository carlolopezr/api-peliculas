const sizeOf = require('image-size');

const getImageResolution = (path) => {
    return new Promise((resolve, reject) => {
        sizeOf(path, (err, dimensions) => {
            if (err) {
                reject(err);
            } else {
                resolve(dimensions);
            }
        });
    });
};

module.exports = getImageResolution;