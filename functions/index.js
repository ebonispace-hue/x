const { onValueWritten } = require("firebase-functions/v2/database");

exports.checkSheetsSync = onValueWritten(
  {
    ref: "/rentals/{id}",
    region: "asia-southeast2"
  },
  async (event) => {
    console.log("Rental berubah:", event.params.id);
  }
);
