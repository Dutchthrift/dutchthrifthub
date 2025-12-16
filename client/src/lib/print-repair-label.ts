export const printRepairLabel = (repair: any) => {
  const printWindow = window.open('', '_blank', 'width=400,height=300');
  if (!printWindow) return;

  const repairId = repair.repairNumber || `#${repair.id.slice(0, 6)}`;
  const date = repair.createdAt ? new Date(repair.createdAt).toLocaleDateString('nl-NL') : '-';

  // Data mapping based on user request
  // Titel: repair.title
  // Merk & Model: repair.productName
  // Probleem Categorie: repair.issueCategory
  const title = repair.title || '-';
  const merkModel = repair.productName || '-';
  const issueCategory = repair.issueCategory || '-';

  printWindow.document.write(`
    <html>
      <head>
        <title>DYMO Label - ${repairId}</title>
        <style>
          @page {
            size: 101mm 54mm;
            margin: 0;
          }
          body {
            width: 101mm;
            height: 54mm;
            margin: 0;
            padding: 2mm 4mm;
            box-sizing: border-box;
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            gap: 2mm;
            overflow: hidden;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 2px;
            margin-bottom: 2px;
          }
          .repair-id {
            font-size: 18pt;
            font-weight: 800;
            font-family: monospace;
          }
          .date {
            font-size: 10pt;
            font-weight: 600;
          }
          .content {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          .row {
            font-size: 9pt;
            line-height: 1.2;
          }
          .label {
            font-weight: bold;
            margin-right: 4px;
          }
          .value {
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <span class="repair-id">${repairId}</span>
          <span class="date">${date}</span>
        </div>
        <div class="content">
          <div class="row">
            <span class="label">Titel:</span>
            <span class="value">${title}</span>
          </div>
          <div class="row">
            <span class="label">Merk & Model:</span>
            <span class="value">${merkModel}</span>
          </div>
          <div class="row">
            <span class="label">Probleem Categorie:</span>
            <span class="value">${issueCategory}</span>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => { window.close(); }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
