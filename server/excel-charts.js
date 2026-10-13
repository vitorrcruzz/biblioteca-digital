// ExcelJS handles cells/tables. These small OOXML parts add native, editable charts.
const JSZip = require('jszip');
const xml = value => String(value).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const chartNS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const relNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function chart({sheet, title, labels, values, labelRange, valueRange, horizontal}) {
  const ref = range => xml(`'${sheet.replace(/'/g, "''")}'!${range}`);
  const points = array => array.map((v,i) => `<c:pt idx="${i}"><c:v>${xml(v)}</c:v></c:pt>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${chartNS}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<c:lang val="pt-BR"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-BR" sz="1200"/><a:t>${xml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
<c:plotArea><c:layout/><c:barChart><c:barDir val="${horizontal ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>
<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Livros concluídos</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="8B5CB3"/></a:solidFill></c:spPr>
<c:cat><c:strRef><c:f>${ref(labelRange)}</c:f><c:strCache><c:ptCount val="${labels.length}"/>${points(labels)}</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>${ref(valueRange)}</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="${values.length}"/>${points(values)}</c:numCache></c:numRef></c:val></c:ser>
<c:gapWidth val="70"/><c:axId val="100"/><c:axId val="200"/></c:barChart>
<c:catAx><c:axId val="100"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="${horizontal ? 'l' : 'b'}"/><c:tickLblPos val="nextTo"/><c:crossAx val="200"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>
<c:valAx><c:axId val="200"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:axPos val="${horizontal ? 'b' : 'l'}"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="100"/><c:crosses val="autoZero"/><c:crossBetween val="between"/><c:majorUnit val="${Math.max(1,Math.ceil(Math.max(0,...values)/5))}"/></c:valAx>
</c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}
async function addCharts(buffer, sheets) {
  const zip = await JSZip.loadAsync(buffer);
  let types = await zip.file('[Content_Types].xml').async('string');
  let chartId = 0;
  for (let i = 0; i < sheets.length; i++) {
    const {charts, row} = sheets[i];
    const id = i + 1;
    let anchors = '', relations = '';
    let nextRow = row;
    for (const spec of charts) {
      const cid = ++chartId;
      const height = spec.horizontal ? Math.max(14, spec.labels.length * 2) : 14;
      zip.file(`xl/charts/chart${cid}.xml`, chart(spec));
      types = types.replace('</Types>', `<Override PartName="/xl/charts/chart${cid}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
      relations += `<Relationship Id="rId${cid}" Type="${relNS}/chart" Target="../charts/chart${cid}.xml"/>`;
      anchors += `<xdr:twoCellAnchor><xdr:from><xdr:col>15</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${nextRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>23</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${nextRow + height}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${cid}" name="Chart ${cid}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${chartNS}"><c:chart xmlns:c="${chartNS}" xmlns:r="${relNS}" r:id="rId${cid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
      nextRow += height + 2;
    }
    zip.file(`xl/drawings/drawing${id}.xml`, `<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</xdr:wsDr>`);
    zip.file(`xl/drawings/_rels/drawing${id}.xml.rels`, `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations}</Relationships>`);
    const sheetPath = `xl/worksheets/sheet${id}.xml`;
    const sheetXML = await zip.file(sheetPath).async('string');
    // Drawing precedes tableParts in the worksheet schema.
    const drawing = `<drawing r:id="rIdExportCharts"/>`;
    zip.file(sheetPath, sheetXML.includes('<tableParts') ? sheetXML.replace('<tableParts', drawing + '<tableParts') : sheetXML.replace('</worksheet>', drawing + '</worksheet>'));
    const relPath = `xl/worksheets/_rels/sheet${id}.xml.rels`;
    let rels = zip.file(relPath) ? await zip.file(relPath).async('string') : '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    rels = rels.replace('</Relationships>', `<Relationship Id="rIdExportCharts" Type="${relNS}/drawing" Target="../drawings/drawing${id}.xml"/></Relationships>`);
    zip.file(relPath, rels);
    types = types.replace('</Types>', `<Override PartName="/xl/drawings/drawing${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
  }
  zip.file('[Content_Types].xml', types);
  return zip.generateAsync({type:'nodebuffer', compression:'DEFLATE'});
}
module.exports = {addCharts};
