/**
 * Runs all servers.
 * Close all with "ctrl+c"
 **/
 
const closeNoMsg = require('./closeNoMsg');
const closeWithMsg = require('./closeWithMsg');
const openNoMsg = require('./openNoMsg');
const openWithMsg = require('./openWithMsg');
const closeInstantNoMsg = require('./closeInstantNoMsg');
const closeInstantWithMsg = require('./closeInstantWithMsg');


openWithMsg();
openNoMsg();
closeWithMsg();
closeNoMsg();
closeInstantNoMsg();
closeInstantWithMsg();