import { test, expect } from '@playwright/test';

function samplePdf() {
  const content = 'BT /F1 18 Tf 72 720 Td (Hello Librarian) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(pdf).length); pdf += `${index+1} 0 obj\n${object}\nendobj\n`; });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test('guest opens a public collection and reads a PDF with the mobile reader', async ({ page }) => {
  const bytes = samplePdf();
  await page.route('**/.netlify/functions/collection-config', route => route.fulfill({ json: { supabaseUrl:'https://accounts.example.test', publishableKey:'public-test-key' } }));
  await page.route('**/.netlify/functions/collections?slug=field-notes', route => route.fulfill({ json: { collection:{ id:'11111111-1111-4111-8111-111111111111',title:'Field Notes',slug:'field-notes',description:'A small test library.',visibility:'public',theme:'linen' }, books:[{ id:'22222222-2222-4222-8222-222222222222',title:'Hello Reader',author:'Test Curator',tags:['notes'],page_count:1,thumbnail_data:'' }] } }));
  await page.route('**/.netlify/functions/collection-files?action=read', route => route.fulfill({ json:{ book:{id:'22222222-2222-4222-8222-222222222222',title:'Hello Reader',author:'Test Curator'},url:'https://storage.example.test/book.pdf' } }));
  await page.route('https://storage.example.test/book.pdf', route => route.fulfill({ status:200, contentType:'application/pdf', headers:{'access-control-allow-origin':'*','accept-ranges':'bytes'}, body:bytes }));

  await page.goto('/?collection=field-notes');
  await expect(page.getByRole('heading', { name:'Field Notes' })).toBeVisible();
  await expect(page.getByText('Hello Reader')).toBeVisible();
  await page.locator('[data-read="22222222-2222-4222-8222-222222222222"]').click();
  await expect(page.getByRole('dialog', { name:/Hello Reader/ })).toBeVisible();
  await expect(page.locator('[data-canvas]')).toHaveJSProperty('width', 703);
  await expect(page.getByText('Page 1 / 1')).toBeVisible();
});

test('curator signs in, creates a library, and securely uploads a validated PDF', async ({ page }) => {
  const bytes = samplePdf(); let saved = null, uploaded = false;
  await page.route('**/.netlify/functions/collection-config', route => route.fulfill({ json: { supabaseUrl:'https://accounts.example.test', publishableKey:'public-test-key' } }));
  await page.route('https://accounts.example.test/auth/v1/signup', route => route.fulfill({ json:{access_token:'a'.repeat(30),refresh_token:'r'.repeat(30),user:{email:'curator@example.test'} } }));
  await page.route('**/.netlify/functions/collections?mine=1', route => route.fulfill({ json:{collections:saved?[saved]:[]} }));
  await page.route('**/.netlify/functions/collections*', async route => {
    if (route.request().method()==='POST') { saved={id:'11111111-1111-4111-8111-111111111111',title:'Field Notes',slug:'field-notes',description:'A small archive',visibility:'unlisted',theme:'midnight'}; return route.fulfill({status:201,json:{collection:saved}}); }
    if (route.request().url().includes('slug=field-notes')) return route.fulfill({json:{collection:saved,books:uploaded?[{id:'22222222-2222-4222-8222-222222222222',title:'Field notebook',author:'Ada Curator',tags:['archive'],sort_order:0,thumbnail_data:''}]:[]}});
    return route.fulfill({json:{collections:[]} });
  });
  await page.route('**/.netlify/functions/collection-files?action=start', route => route.fulfill({status:201,json:{bookId:'22222222-2222-4222-8222-222222222222',uploadUrl:'https://storage.example.test/upload'}}));
  await page.route('https://storage.example.test/upload', async route => { uploaded=true; await route.fulfill({status:200,json:{Key:'uploaded'}}); });
  await page.route('**/.netlify/functions/collection-files?action=finish', route => route.fulfill({json:{ready:true}}));

  await page.goto('/?collections=1');
  await page.getByLabel('Email').fill('curator@example.test'); await page.getByLabel('Password').fill('correct-horse-9');
  await page.getByRole('button',{name:'Create curator account'}).click();
  await page.getByLabel('Collection title').fill('Field Notes'); await page.getByLabel('Custom URL slug').fill('field-notes');
  await page.getByLabel('Description').fill('A small archive'); await page.getByLabel('Visibility').selectOption('unlisted'); await page.getByLabel('Theme').selectOption('midnight');
  await page.getByRole('button',{name:'Create collection'}).click();
  await page.getByRole('button',{name:'QR code'}).click();
  await expect(page.getByRole('dialog',{name:'Share QR code'})).toBeVisible();
  await expect(page.getByAltText('QR code for Field Notes')).toHaveAttribute('src',/^data:image\/png/);
  await page.getByRole('button',{name:'Close QR code'}).click();
  await page.getByLabel('Choose PDF').setInputFiles({name:'field-notebook.pdf',mimeType:'application/pdf',buffer:bytes});
  await page.getByLabel('Author').fill('Ada Curator'); await page.getByLabel('Tags').fill('archive');
  await page.getByLabel('I own this work or have permission to share this PDF.').check();
  await page.getByRole('button',{name:'Add PDF'}).click();
  await expect(page.getByText('Field notebook')).toBeVisible();
  expect(uploaded).toBeTruthy();
});
