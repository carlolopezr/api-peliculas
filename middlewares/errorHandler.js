const { sendNotificationEmail, deleteFilesInBucket } = require("../controllers/video");


const errorHandler = async (err, req, res, next) => {
    try {
      if (!req.email || !req.data) {
        return;
      }
      const email = req.email || null;
      const { user_id, date } = req.data || null;
      console.log(email, user_id, date);
      const notificaciónEmail = {
        email: email,
        subject: 'Ha ocurrido un error',
        text: err.message
      };

      const statusCode = err.customStatus || 500
  
      if (statusCode == 602) {
        await sendNotificationEmail(notificaciónEmail);
      }
  
      if (statusCode == 601) {
        await sendNotificationEmail(notificaciónEmail);
        await deleteFilesInBucket(user_id, date);
      }
      
      return
    } catch (error) {
      console.log(error);
    }
  };

module.exports = errorHandler