const fs = require('fs');
try {
  fs.copyFileSync('C:/Users/reddy/OneDrive/Desktop/PopCLozet-Apps/docs/Cookies policy.pdf', 'C:/Users/reddy/OneDrive/Desktop/PopCLozet-Apps/apps/customer-app/public/docs/Cookies policy.pdf');
  fs.copyFileSync('C:/Users/reddy/OneDrive/Desktop/PopCLozet-Apps/docs/Privacy policy.pdf', 'C:/Users/reddy/OneDrive/Desktop/PopCLozet-Apps/apps/customer-app/public/docs/Privacy policy.pdf');
  fs.copyFileSync('C:/Users/reddy/OneDrive/Desktop/PopCLozet-Apps/docs/Terms & condition_popclozet.pdf', 'C:/Users/reddy/OneDrive/Desktop/PopCLozet-Apps/apps/customer-app/public/docs/Terms & condition_popclozet.pdf');
  console.log("Files copied successfully");
} catch(e) {
  console.error("Error copy", e);
}
