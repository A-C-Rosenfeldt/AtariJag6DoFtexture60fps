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

let vertices=[[-5,-3],[+5,-3],[0,7]]

let v_s=vertices.map( v => v.map(c=> Math.floor(c+7.5 )) )

let extrema=[[-1,+8],[-1,-8]]

v_s.forEach((v,k)=>{
	let p=(v[1]*16 + v[0] )*4
	for(let i=p;i<p+4;i++)
		pixel[ i  ]=255

	if (extrema[0][1]>v[1]) extrema[0]=[k,v[1]]
	if (extrema[1][1]<v[1]) extrema[1]=[k,v[1]]	
})

// this gives me up to 4 edges here in 2d. But what in 3d where I derive edge equations indepenently?
//// I guess I simply need to choose an epsilon?

// Rounding errors may result in non-monotonous y-ordinate along the sides
// I just ratchet y? I need some pics with the DMZs the size of a pixel

// Todo: The name "field" stems from the MosFet simulator
// Just call it: Plain old 32 bit color bitmap mode as present on AtariJaguar
  field2Gl("CanvasPolygon",[{pixel:pixel,width:16,height:16}]);

  // Does the convex polygon code fail
  // I use vertex_y to dodge divide by zero