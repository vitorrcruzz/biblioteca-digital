const router = require('express').Router();
const {getUserDb} = require('../database');
const {createExport, exportData} = require('../excel-export');

router.get('/excel', async (req, res) => {
  const data = exportData(getUserDb(req.user.uid), req.query.year);
  const buffer = await createExport(data);
  const suffix = req.query.year && req.query.year !== 'all' ? req.query.year : 'todos-os-anos';
  res.set('Cache-Control', 'no-store');
  res.attachment(`biblioteca-${suffix}.xlsx`);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});
module.exports = router;
