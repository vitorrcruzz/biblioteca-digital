const ExcelJS = require('exceljs');
const {addCharts} = require('./excel-charts');
const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const STATUS = {finished: 'Concluído', reading: 'Lendo', paused: 'Pausado'};
const PURPLE = 'E0CEEE', INK = '352647';
function date(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? null : d;
}
function rangeFormula(sheet, cell, formula, result, numFmt) {
  sheet.getCell(cell).value = {formula, result};
  if (numFmt) sheet.getCell(cell).numFmt = numFmt;
}
function band(sheet, range, text) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(':')[0]);
  cell.value = text;
  cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:PURPLE}};
  cell.font = {name:'Arial', size:11, bold:true, color:{argb:INK}};
  cell.alignment = {vertical:'middle', horizontal:'center', wrapText:true};
}
async function createExport({books, goals, years, generatedAt = new Date()}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Biblioteca Digital';
  workbook.created = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  const drawings = [];
  for (const year of years) {
    const entries = books.filter(b => b.year === year);
    const finished = entries.filter(b => b.status === 'finished');
    const sheet = workbook.addWorksheet(`Livros ${year}`, {views:[{state:'frozen', ySplit:2, showGridLines:false}], properties:{defaultRowHeight:24}});
    const widths = [42,13,13,13,10,26,11,20,12,15,20,28,10,12,3,13,13,11,11,16,12,12,12];
    widths.forEach((width,i) => {sheet.getColumn(i+1).width=width;});
    band(sheet,'A1:N1',`Lista de Leitura ${year}`);
    sheet.getRow(1).height=28;
    const rows = entries.map(b => [b.title,date(b.start_date),date(b.end_date),null,null,b.author,b.pages || 0,b.category || '',b.rating || null,STATUS[b.status] || b.status,b.subcategory || '',b.saga_name || '',b.saga_order ?? null,b.is_reread ? 'Sim' : 'Não']);
    sheet.addTable({name:`Livros_${year}`, ref:'A2', headerRow:true, style:{theme:null,showRowStripes:false},
      columns:['Título','Início','Término','Duração','Mês','Autor','Páginas','Categoria','Avaliação','Status','Subcategoria','Saga/Coleção','Volume','Releitura'].map(name=>({name,filterButton:true})), rows: rows.length ? rows : [Array(14).fill(null)]});
    const end = Math.max(3, entries.length+2);
    for (let r=2;r<=end;r++) {
      sheet.getRow(r).height = r === 2 ? 30 : Math.min(300, Math.max(32, Math.ceil((entries[r-3]?.title || '').length / 38) * 16));
      for(let c=1;c<=14;c++) {
        const cell=sheet.getCell(r,c);
        cell.font={name:'Arial',size:11,color:{argb:INK},bold:r===2};
        cell.alignment={vertical:'middle',wrapText:true,horizontal:[2,3,4,5,9,10,13,14].includes(c)?'center':undefined};
        if(r>2) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r%2?'F5EFFA':'FFFFFF'}};
        if(r===2) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:PURPLE}};
      }
      sheet.getCell(`B${r}`).numFmt='dd/mm/yyyy'; sheet.getCell(`C${r}`).numFmt='dd/mm/yyyy';
      sheet.getCell(`I${r}`).numFmt='0.0';
      if(r<3 || !entries[r-3]) continue;
      const b=entries[r-3], start=date(b.start_date), finish=date(b.end_date);
      const days=start && finish ? (finish-start)/86400000+1 : '';
      rangeFormula(sheet,`D${r}`,`IF(OR(B${r}="",C${r}=""),"",C${r}-B${r}+1)`,days,'0" dias"');
      rangeFormula(sheet,`E${r}`,`IF(C${r}="","",CHOOSE(MONTH(C${r}),${MONTHS.map(m=>'"'+m+'"').join(',')}))`,finish?MONTHS[finish.getUTCMonth()]:'');
    }
    const table=`Livros_${year}`;
    const monthly=MONTHS.map((m,i)=>finished.filter(b=>date(b.end_date)?.getUTCMonth()===i).length);
    const cats=[...new Set(entries.map(b=>b.category || '').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const categoryCounts=cats.map(c=>finished.filter(b=>b.category===c).length);
    band(sheet,'P1:S1','Livros concluídos'); sheet.mergeCells('P2:S3');
    rangeFormula(sheet,'P2',`COUNTIF(${table}[Status],"Concluído")`,finished.length,'0');
    band(sheet,'T1:W1','Média por mês com leitura'); sheet.mergeCells('T2:W3');
    const monthsRead=monthly.filter(n=>n>0).length;
    rangeFormula(sheet,'T2','IF(COUNTIF(Q11:Q22,">0")=0,0,SUM(Q11:Q22)/COUNTIF(Q11:Q22,">0"))',monthsRead?monthly.reduce((sum,n)=>sum+n,0)/monthsRead:0,'0.0');
    band(sheet,'P5:S5','Páginas concluídas'); sheet.mergeCells('P6:S7');
    rangeFormula(sheet,'P6',`SUMIF(${table}[Status],"Concluído",${table}[Páginas])`,finished.reduce((sum,b)=>sum+(b.pages||0),0),'#,##0');
    band(sheet,'T5:W5','Exportado em'); sheet.mergeCells('T6:W7'); sheet.getCell('T6').value=generatedAt; sheet.getCell('T6').numFmt='dd/mm/yyyy';
    sheet.getCell('P10').value='Mês';sheet.getCell('Q10').value='Concluídos';
    for(let i=0;i<12;i++) {
      sheet.getCell(`P${i+11}`).value=MONTHS[i];
      rangeFormula(sheet,`Q${i+11}`,`COUNTIFS(${table}[Mês],P${i+11},${table}[Status],"Concluído")`,monthly[i],'0');
    }
    band(sheet,'T10:V10','Categoria');sheet.getCell('W10').value='Concluídos';
    for(let i=0;i<cats.length;i++) {
      sheet.mergeCells(`T${i+11}:V${i+11}`);sheet.getCell(`T${i+11}`).value=cats[i];
      rangeFormula(sheet,`W${i+11}`,`COUNTIFS(${table}[Categoria],"="&SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(T${i+11},"~","~~"),"*","~*"),"?","~?"),${table}[Status],"Concluído")`,categoryCounts[i],'0');
    }
    if(!cats.length) {sheet.mergeCells('T11:V11');sheet.getCell('T11').value='Sem categorias';sheet.getCell('W11').value=0;}
    const summaryRow=Math.max(25,cats.length+13);
    band(sheet,`P${summaryRow}:S${summaryRow}`,'Meta de leitura');sheet.mergeCells(`P${summaryRow+1}:S${summaryRow+2}`);
    const goal=goals.find(g=>g.year===year)?.target;
    sheet.getCell(`P${summaryRow+1}`).value=goal ?? 'Não definida';
    band(sheet,`T${summaryRow}:W${summaryRow}`,'Progresso da meta');sheet.mergeCells(`T${summaryRow+1}:W${summaryRow+2}`);
    rangeFormula(sheet,`T${summaryRow+1}`,`IF(ISNUMBER(P${summaryRow+1}),IF(P${summaryRow+1}>0,P2/P${summaryRow+1},""),"")`,goal?finished.length/goal:'','0%');
    for(const cell of ['P2','T2','P6','T6',`P${summaryRow+1}`,`T${summaryRow+1}`]) {
      sheet.getCell(cell).font={name:'Arial',size:16,bold:true,color:{argb:INK}};
      sheet.getCell(cell).alignment={horizontal:'center',vertical:'middle',wrapText:true};
    }
    sheet.addConditionalFormatting({ref:`J3:J${end}`,rules:[{type:'containsText',operator:'containsText',text:'Concluído',style:{font:{color:{argb:'237347'}}}},{type:'containsText',operator:'containsText',text:'Pausado',style:{font:{color:{argb:'A66300'}}}}]});
    const charts=[{sheet:sheet.name,title:'Livros concluídos por mês',labels:MONTHS,values:monthly,labelRange:'$P$11:$P$22',valueRange:'$Q$11:$Q$22'}];
    if(cats.length) charts.push({sheet:sheet.name,title:'Livros concluídos por categoria',labels:cats,values:categoryCounts,labelRange:`$T$11:$T$${cats.length+10}`,valueRange:`$W$11:$W$${cats.length+10}`,horizontal:true});
    drawings.push({charts,row:summaryRow+4});
  }
  return addCharts(await workbook.xlsx.writeBuffer(),drawings);
}
function exportData(db, requestedYear) {
  const years=db.prepare('SELECT year FROM books UNION SELECT year FROM goals ORDER BY year DESC').all().map(r=>r.year);
  if(requestedYear !== undefined && requestedYear !== 'all') {
    if(typeof requestedYear !== 'string' || !/^\d{4}$/.test(requestedYear) || !years.includes(Number(requestedYear))) {
      const err=new Error('Selecione um ano registrado na conta.');err.status=400;throw err;
    }
  }
  const selected=requestedYear && requestedYear!=='all' ? [Number(requestedYear)] : years;
  if(!selected.length) {const err=new Error('Nenhum ano registrado para exportar.');err.status=400;throw err;}
  const filter=selected.length===1?' WHERE b.year = ?':'';
  return {years:selected,goals:db.prepare('SELECT * FROM goals').all(),books:db.prepare(`SELECT b.*, s.name AS saga_name FROM books b LEFT JOIN sagas s ON s.id=b.saga_id${filter} ORDER BY b.year DESC, COALESCE(NULLIF(b.end_date,''),NULLIF(b.start_date,''),''), b.id`).all(...(selected.length===1?selected:[]))};
}
module.exports={createExport,exportData};
