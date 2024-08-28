import { google } from "googleapis";

const spreadsheetId = process.env.SPREAD_SHEET_ID;

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_KEYFILE,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

async function readSheet(range: string) {
  const sheets = google.sheets({
    version: "v4",
    auth,
  });
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = response.data.values;
    return rows;
  } catch (error) {
    console.error("error", error);
  }
}

async function writeRow(data: string[], range: string) {
  const sheets = google.sheets({
    version: "v4",
    auth,
  });
  try {
    sheets.spreadsheets.values.append({
      spreadsheetId,
      range: range, // Assuming the data should be written in the next available row
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS", // Specify to insert the data in a new row
      requestBody: {
        values: [data],
      },
    });
    console.log("Data written successfully");
  } catch (error) {
    console.error("Error writing data", error);
  }
}
export { readSheet, writeRow };
