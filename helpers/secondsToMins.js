
const secondsToMins = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60; 

    const minutesStr = `${minutes}:${remainingSeconds}`;
    return minutesStr;
}

module.exports = secondsToMins