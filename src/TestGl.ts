import { field2Gl } from './GL.js'

const pixel = new Uint8ClampedArray(1024); // 2+4+4 = 10
pixel[0] = 0; //[0, 0, 255, 255];  // opaque blue
pixel[1] = 0;
pixel[2] = 255;
pixel[3] = 255;
var i: number = 4
for(;i<32;){
pixel[i++] = 255; //[0, 0, 255, 255];  // opaque red
pixel[i++] = 0;
pixel[i++] = 0;
pixel[i++] = 255;
}

for(;i<64;){
  pixel[i++] = 0; //[0, 0, 255, 255];  // opaque green
  pixel[i++] = 255;
  pixel[i++] = 0;
  pixel[i++] = 255;
  }

  for(;i<1024;){
    pixel[i++] = 64
    pixel[i++] = 64;
    pixel[i++] = 64
    pixel[i++] = 255;
    if ((i >>2 )%15 ){
        pixel[i++] = 192
        pixel[i++] = 192
        pixel[i++] = 192
        pixel[i++] = 255;
    }
  }

// Todo: The name "field" stems from the MosFet simulator
// Just call it: Plain old 32 bit color bitmap mode as present on AtariJaguar
  field2Gl("GlCanvas",[{pixel:pixel,width:16,height:16}]);

  // Follow up: TestGL_2dPolygon_withFixedPointVertices