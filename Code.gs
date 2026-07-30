function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // --- ADMIN MODE: Creating / Updating keys (Requires Password) ---
    if (data.adminSecret) {
      const ADMIN_PASSWORD = "MY_SUPER_SECRET_ADMIN_PASSWORD_123"; // Change this to your secure password
      
      if (data.adminSecret !== ADMIN_PASSWORD) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid admin password." }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const key = data.licenseKey;
      const durationDays = parseInt(data.durationDays, 10) || 30;
      
      // Append row: [Key, Duration Days, Expires At (Blank until used), Is Active (FALSE), Activated At (Blank)]
      sheet.appendRow([key, durationDays, "", "FALSE", ""]);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Key created successfully." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // --- USER MODE: Retrieving & Verifying a key ---
    const userKey = data.licenseKey ? data.licenseKey.trim() : "";
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
      const rowKey = String(rows[i][0]).trim();
      
      if (rowKey === userKey) {
        const durationDays = Number(rows[i][1]);
        let isActive = String(rows[i][3]).toUpperCase() === "TRUE";
        let expiresAtStr = rows[i][2];
        const now = new Date();
        
        // If first-time activation, calculate and save expiration date
        if (!isActive || !expiresAtStr) {
          const expirationDate = new Date();
          expirationDate.setDate(now.getDate() + durationDays);
          
          sheet.getRange(i + 1, 4).setValue("TRUE");                  // Is Active (Col D)
          sheet.getRange(i + 1, 3).setValue(expirationDate.toISOString()); // Expires At (Col C)
          sheet.getRange(i + 1, 5).setValue(now.toISOString());          // Activated At (Col E)
          
          expiresAtStr = expirationDate.toISOString();
        }
        
        // Check if the key has expired
        if (new Date() > new Date(expiresAtStr)) {
          return ContentService.createTextOutput(JSON.stringify({ success: false, message: "License key has expired." }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        
        return ContentService.createTextOutput(JSON.stringify({ success: true, expiresAt: expiresAtStr }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Unauthorized access." }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Optional: Allows testing GET requests directly in browser
function doGet(e) {
  return ContentService.createTextOutput("Gym Tracker Elite License Server is active and running.")
    .setMimeType(ContentService.MimeType.TEXT);
}
