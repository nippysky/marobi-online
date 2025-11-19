// Tell TypeScript what lives at 'pdfkit/js/pdfkit.standalone.js'
declare module "pdfkit/js/pdfkit.standalone.js" {
  import PDFKit = require("pdfkit");
  export = PDFKit; // works with esModuleInterop default import
}
