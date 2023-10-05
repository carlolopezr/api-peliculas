const { sendNotificationEmail, deleteFilesInBucket } = require("../controllers/video");


const errorHandler = async (err, req, res, next) => {
    try {
      const email = req.email;
      const { user_id, date } = req.data;
      console.log(email, user_id, date);
      const notificaciónEmail = {
        email: email,
        subject: 'Ha ocurrido un error',
        text: err.message
      };

      const statusCode = err.customStatus || 500
  
      if (err) {
        await sendNotificationEmail(notificaciónEmail);
      }
  
      if (statusCode == 601) {
        await deleteFilesInBucket(user_id, date);
      }
  
      return;
    } catch (error) {
      console.log(error);
    }
  };

module.exports = errorHandler