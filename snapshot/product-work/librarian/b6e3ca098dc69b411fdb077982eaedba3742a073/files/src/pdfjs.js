import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let library;
export function loadPdfjs() {
  library ??= import('pdfjs-dist/build/pdf.mjs').then(pdf => {
    pdf.GlobalWorkerOptions.workerSrc = workerURL;
    return pdf;
  }).catch(error => { library = undefined; throw error; });
  return library;
}
