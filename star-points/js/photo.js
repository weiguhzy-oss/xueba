/* ============================================================
   成为学霸 · avatar photo handling
   A phone camera JPEG is several MB, and localStorage holds roughly
   5MB for the whole app. Every picked image is therefore centre-cropped
   to a square and re-encoded small before it ever reaches the store.
   ============================================================ */
(function (global) {
  'use strict';

  var SIZE = 192;        // stored edge length in px (2x the 96px display)
  var QUALITY = 0.82;    // JPEG quality; ~12-18KB per avatar at this size

  /**
   * Reads a File into a square, downscaled JPEG data-URL.
   * cb(err, dataUrl)
   */
  function fromFile(file, cb) {
    if (!file) return cb(new Error('no file'));
    if (!/^image\//.test(file.type)) return cb(new Error('not an image'));

    var reader = new FileReader();
    reader.onerror = function () { cb(new Error('read failed')); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { cb(new Error('decode failed')); };
      img.onload = function () {
        try {
          cb(null, squareCrop(img));
        } catch (err) {
          cb(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // Centre-crops to a square and scales to SIZE.
  function squareCrop(img) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    var edge = Math.min(w, h);
    var sx = Math.round((w - edge) / 2);
    var sy = Math.round((h - edge) / 2);

    var canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, edge, edge, 0, 0, SIZE, SIZE);
    return canvas.toDataURL('image/jpeg', QUALITY);
  }

  global.Photo = { fromFile: fromFile, SIZE: SIZE };
})(window);
