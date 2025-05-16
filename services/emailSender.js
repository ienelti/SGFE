const nodemailer = require("nodemailer");
require("dotenv").config();
const path = require("path");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === "true", // STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendInvoiceEmail = async (to, zipFilePath, log, logError) => {
  const fileName = path.basename(zipFilePath);

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject: process.env.EMAIL_SUBJECT,
    text: ' ',
    attachments: [
        {
        filename: fileName,
        path: zipFilePath,
        contentType: "application/zip",
        },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    log(`Correo enviado a ${to} con adjunto ${fileName}`);
    return true;
  } catch (error) {
    logError(`Error al enviar correo a ${to}:`, error);
    console.error(`Error al enviar correo a ${to}:`, error);
    return false;
  }
};

module.exports = {
  sendInvoiceEmail,
};