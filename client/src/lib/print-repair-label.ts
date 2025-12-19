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
            size: 32mm 57mm;
            margin: 0;
          }
          body {
            width: 32mm;
            height: 57mm;
            margin: 0;
            padding: 2mm;
            box-sizing: border-box;
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            gap: 1mm;
            overflow: hidden;
          }
          .header {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            border-bottom: 1px solid #000;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .repair-id {
            font-size: 12pt;
            font-weight: 800;
            font-family: monospace;
          }
          .date {
            font-size: 7pt;
            font-weight: 600;
          }
          .content {
            display: flex;
            flex-direction: column;
            gap: 1mm;
          }
          .row {
            font-size: 6pt;
            line-height: 1.1;
          }
          .label {
            font-weight: bold;
            display: block;
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
