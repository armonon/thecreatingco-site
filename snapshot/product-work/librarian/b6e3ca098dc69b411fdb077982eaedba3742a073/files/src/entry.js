const params = new URLSearchParams(location.search);
if (params.has('collections') || params.has('collection')) import('./collections.js');
else import('./main.js');
