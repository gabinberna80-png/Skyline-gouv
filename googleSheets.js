require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

let spreadsheet = null;
let _canWrite = false;

function getEnvValue(name) {
  return process.env[name] || '';
}

function getSheetClient() {
  if (spreadsheet) return spreadsheet;

  const serviceAccountEmail = getEnvValue('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = getEnvValue('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  const spreadsheetId = getEnvValue('GOOGLE_SPREADSHEET_ID');
  const apiKey = getEnvValue('GOOGLE_API_KEY');

  if (!spreadsheetId) return null;

  // Prefer service account (read+write)
  if (serviceAccountEmail && privateKey) {
    const jwt = new JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    spreadsheet = new GoogleSpreadsheet(spreadsheetId, jwt);
    _canWrite = true;
    return spreadsheet;
  }

  // Fallback: API key for public, read-only access
  if (apiKey) {
    spreadsheet = new GoogleSpreadsheet(spreadsheetId, { apiKey });
    _canWrite = false;
    return spreadsheet;
  }

  return null;
}

async function ensureSheetReady() {
  const doc = getSheetClient();
  if (!doc) return null;

  const sheetTitle = getEnvValue('GOOGLE_SHEET_TITLE') || 'RDV';

  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[sheetTitle] || doc.sheetsByIndex[0];
  if (!sheet) return null;
  return sheet;
}

function buildRdvRow(request) {
  return [
    request.id || '',
    request.userTag || '',
    request.reason || '',
    request.date || '',
    request.time || '',
    request.channelName || '',
    request.createdAt || '',
  ];
}

function buildCitizenRow(citizen) {
  return [
    citizen.nom || '',
    citizen.prenom || '',
    citizen.anneeNaissance || '',
    citizen.nationalite || '',
    citizen.lieuNaissance || '',
    citizen.sexe || '',
    citizen.casier || '',
  ];
}

async function appendRdvRequest(request) {
  const sheet = await ensureSheetReady();
  if (!sheet) return false;

  const headers = await sheet.getHeaderRow().catch(() => []);
  if (!headers.length) {
    await sheet.setHeaderRow([
      'id',
      'userTag',
      'reason',
      'date',
      'time',
      'channelName',
      'createdAt',
    ]);
  }

  await sheet.addRow(buildRdvRow(request));
  return true;
}

async function appendCitizen(citizen) {
  const sheetTitle = process.env.GOOGLE_SHEET_TITLE || 'Citoyens';
  const doc = getSheetClient();
  if (!doc) return false;
  if (!_canWrite) return false;

  await doc.loadInfo();
  let sheet = doc.sheetsByTitle[sheetTitle];
  if (!sheet) {
    sheet = await doc.addSheet({
  title: sheetTitle,
  headerValues: ['Nom', 'Prénom', 'Année de naissance', 'Nationalité', 'Lieu de naissance', 'Sexe', 'casier'],
});

  await sheet.addRow(buildCitizenRow(citizen));
  return true;
}

async function getCitizens() {
  const sheetTitle = process.env.GOOGLE_SHEET_TITLE || 'Citoyens';
  const doc = getSheetClient();
  if (!doc) return [];

  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[sheetTitle];
  if (!sheet) return [];

  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  if (rows.length) console.log('ROW0 KEYS:', rows[0]._rawData, rows[0].toObject?.());
  return rows.map((row) => ({
    nom: row.get('Nom') || row.get('nom') || '',
    prenom: row.get('Prénom') || row.get('prénom') || row.get('prenom') || '',
    anneeNaissance: row.get('Année de naissance') || row.get('annee de naissance') || '',
    nationalite: row.get('Nationalité') || row.get('nationalité') || '',
    lieuNaissance: row.get('Lieu de naissance') || row.get('lieu de naissance') || '',
    sexe: row.get('Sexe') || row.get('sexe') || '',
    casier: row.get('casier') || row.get('Casier') || '',
  }));
}

module.exports = {
  appendRdvRequest,
  appendCitizen,
  getCitizens,
  buildRdvRow,
  buildCitizenRow,
};
