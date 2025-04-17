import { field2Gl } from './GL.js';
const pixel = new Uint8Array(1024); // 2+4+4 = 10
pixel[0] = 0; //[0, 0, 255, 255];  // opaque blue
pixel[1] = 0;
pixel[2] = 255;
pixel[3] = 255;
var i = 4;
for (; i < 32;) {
    pixel[i++] = 255; //[0, 0, 255, 255];  // opaque blue
    pixel[i++] = 0;
    pixel[i++] = 0;
    pixel[i++] = 255;
}
for (; i < 64;) {
    pixel[i++] = 0; //[0, 0, 255, 255];  // opaque blue
    pixel[i++] = 255;
    pixel[i++] = 0;
    pixel[i++] = 255;
}
field2Gl("GlCanvas", [{ pixel: pixel, width: 16, height: 16 }]);
//# sourceMappingURL=TestGl.js.map