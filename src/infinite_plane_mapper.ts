/**
 * This is used to map (x,y) to (z(w),u,v)
 * Like the early engine that Looking Glass designed, it goes via (s,t) of two edges of a polygon
 

The equations do create a fraction

The nominator does a projection of the view vector onto the plane. This is equivalent to subtracting the normal of the plane
The denominator directly contains the normal of the plane.

The fraction can be split into a sum. In the minus sum, the view vector normal cancels each other. We end up with a constant.
The other part stays as it is. That is okay because it is exactly the same now for z and (s,t) as known from literature


*/

import { Vec3,Vec,Matrix } from "./clipping.js";

//import { SimpleImage } from "./GL";
import { field2Gl, SimpleImage } from './GL.js'

export class CameraViewvector{
	
	cameraPosition: Vec // this is for internal use only . It lives flying  "over the textured plane" (s,t,z)
	// This is an array of Vec3. The first two are the (s,t) vectors, the third is the z vector. Matrix of rows makes sense because the consumer wants to "pull" stz from the screen coordinates.
	viewVector:Matrix   // I have a problem to find a nice way because this is really a function which viewVector as output. Input are the screen coordinates + (const FoV_z)
}

// Here in the source code I show the naive calculation above the corresponding
// prep-calculation which only leaves the one essential Matrix Mul and one division for the loop over the pixels of the polygons
// On a powerhouse like the N64 you would go full 4x4 matrices like in OpenGl, but on Jaguar I try to shave off every element I can
// MMULT is not really powerful. Even on 3do and PS1 matrices are slow and often 3x3. And that is with warping
export class Camera_in_stSpace{
	only: Array<Vec3>;
	normal: Vec3;
	z: number[];
	/*
	Here is the proof. I want it to be inline of the code to be available. At least in short form. We try to avoid the notion of matrix inversion because I want wide flow, not a long cascade

	S,T are vectors spanning the plane around its orgin (yeah, not so plane like, but surely a texture and even z needs an origin) O   ( O is a point )
	C is the Camera position at 0,0,0 . After transformation it will be elsewhere. So it got a name: C
	V is the view vector. It's transformation needs to follow homogenous coordinates to be understood by the rasterizer
	*/

	transform_into_texture_space__constructor(S:Vec3,T:Vec3){
		this.z=[S.v[2],T.v[2]] // ,0] does not help much because next thing I do is pack it with (s,t) from the texture  // not affected by clipping. No flipping around of chosen vertex with adjacent edgesr to invert
		let n=S.crossProduct(T)  // todo: unit Test because this was n=[0,0,0]
		this.normal=n.scalarProduct(Math.sqrt(1/n.innerProduct(n))) as Vec3  // I don't even need it normalized, just keep the direction stick to it for all of CameraViewvector and it needs to fit in 16bit of JRISC.  // uh I need special scalar Product to avoid typeCast ??!
		let coupling=S.innerProduct(T)  // symmetric
		let ST=[[S,T],[T,S]] // pointer even in JS ( and Java, and C#, and please in JRISC -- or loop unroll)
		this.only=ST.map(st=> st[0].subtract(  st[1].scalarProduct(  coupling / st[1].innerProduct(st[1])  )  ) as Vec3)  // this is some ad hoc hack to invert a Matrix, Only look along a direction orthogonal to the other axis.
		for(let i=0;i<this.only.length;i++){
			let effect_of_1st=this.only[i].innerProduct( ST[i][0] )
			if (Math.abs(effect_of_1st)>0.001) this.only[i]=this.only[i].scalarProduct(1/effect_of_1st) as Vec3  // correct scaling
		}
	}

	UVmapping_fromST=[[1,0],[0,1]]  // can load uv mapping into this: z needs to be generated
	UVmapping_Offest=[0,0]

	generate_payload(C:number[],V:number[]):number[]{
		let factor_on_the_right=this.infinte_checkerBoard(C,V)
		// ?? I changed this.z to only contain z expressed in the s,t coordinates. No normal compontent.
		let pl=([this.z].concat(this.UVmapping_fromST).map(p=>p.reduce( (s,c,i)=> s+c*factor_on_the_right[i])))  // need a way to transform this into gradients for rasterizer

		return pl
	}

	uvzw_from_viewvector(C:number[]):Matrix{

		// s, t  = texture cooridinates ( t like texture ). The third is "along Normal" or should I write "Altitude" ?

		const stn_from_viewvector=this.infinte_checkerBoard_m(C)

		// the rest should result in new PixelShader( at_bottomRight_of_Center, gradient )  // InfiniteCheckerBoard is PixelShader
		// view vector has fixed z component => at_bottomRight_of_Center


		// UV mapping to harmonize st with z : none is aligned with any of the edges ( only by luck )
		// UV mapping is great to map one rectangular texture onto a mesh
		// But we don't depend on it here.
		// what mesh?    // First occurence of matrix mul. Not sure about interface. Clearly I need this for rotation (frame to frame), and generally transformation (within frame)
		const uvzw_mapped=new Matrix()
		// the first Vec is the w component of homogenous coordinates (okay, usually w is last?). It feeds the 1/ve[2] through
		// So for the infinite plane, the first two components are actually the view vectors, but the last component is the camer hover height over the plane. Still a naming convention?
		// I need to change to names. One component here adds bias. So it does not bind to the (x,y) input row (mul from left). The other feeds into the denominator on the left. This comes later
		// st does not bind to cv.viewVector.nominator[2>st]  . This is the "down looking" compontent. So we fill the jaggies with 0  (todo: downlooking is special. Move do front division notion (nominator first) makes no sense )
		// the pixel shader wants the const stuff in 0 because x^0  So I moved this to the fron 2025-08-15

		if (this.z.length>2) throw "z length >2 not supported"

		// ToDo: I probably should do away with pos0 and last_pos stuff because I use it for different purposes. Needs names!
		// Todo: Offset for UV (taken from the model) after the MUL. Also offset for z(affected by camera movement). All refering to the (x,t)=(0,0) vertex
		// stz -> uvzz ( z in texture space becomes w=nominator in camera space) . Nominator goes last because tests start with billboards
		// So the screen z (of camera position) is queezed in before the in texture coordinates z (of the camera vector)
		uvzw_mapped.nominator=	this.UVmapping_fromST.map(p=>new Vec3([[...p,0]])).concat( new Vec3( [[...this.z,0]] ), new Vec3( [[0,0,1]] )); // Error: jaggies. In the trivial test with billboard polygon z=00 ( a third 0 is padded )
		// JRISC: replace 001 with code
			// Everone uses the general proof that 1/z is linear in screen space (far plane can be substracted.). Sorry that I cannot utilize my: "just calculate with fractions as in school!"
			// Linear allows for an offset. So 0 does not need to be the horizon. Together with scaling there are two degrees of freedom which can change from polygon to polygon
			// Do polygons bring their far-plane along? Perhaps due to vertex position
			// for inter-polygon comparison ( z-buffer ) we need a standard. So the multiplication with [s.z,t.z.0] 
			// with viewVector should fix scaling
			// with cameraPostion should fix offset  ( both indirectly through cv.nominator)
		console.log("uvzw_mapped",uvzw_mapped.nominator,stn_from_viewvector.nominator)  // For a billboard, uv should interpolate. z=0  w=const. And math says that polygon facing camera gives us -1 ( view vector facing down)
		const uvzw_from_viewvector=Matrix.mul__Matrices_of_Rows( [uvzw_mapped.nominator, stn_from_viewvector.nominator]  ) 
		//cv_p.viewVector=Matrix.mul( [mesh.nominator, cv.viewVector.nominator] )

		// We may need to measure if it is faster to have two different 1/z or to compensate the s,t nominators
		// Only scaling is possible ( and quite fast ). There can be offsets in s t to shift a texture around, but denominator needs to be real 1/z without offset
		// so basically in homogenous NDC coordinates, w is the real 1/z used for division (divergence needs to stay at the horizon). And z is 1/z - 1/far_plane and used for the z-buffer.

		// this.z inner product with s,t traced along lines of const-z is clearly const ( [a,b] is the slope of the horizon )
		// If we proove that we have the same slope in nominator and denominator, we know that really we got on offset in w.
		// we get:              n + ax + by          d + ax + by       n-d
		//                 w = -------------  =  -----------------  + ------------ 
		//                      d + ax + by          d  + ax + by     d + ax + by
		// For the textures we could substract this as bias. But eh, texture don't allow bias to keep the divergence at the horizon.
		// So there cannot be an offset
		// So multiplication with this.z really is just to scale?
		// infinte_checkerBoard_m mixes cv.viewVector.nominator[2] into these components
		return uvzw_from_viewvector
	}

	infinte_checkerBoard(C:number[],V:number[]):number[]{
		const c=this.transform_into_texture_space(C,this.UVmapping_Offest.concat(0)) // pos point of camera
		const v=this.transform_into_texture_space(V) // view vector  ( many vectors for one camera ? )

		const tau=c[2]/v[2]     // todo: use law of ascocitaten to change order of matrix mul and div
		const texel=[0,0]
		for(let st=0;st<2;st++){
			texel[st]=c[st] + tau * v[st]     
		}

		return texel
	}

	// like mode-z on SNES (tm)
 	private infinte_checkerBoard_m(C:number[]):Matrix{
		const cv=new CameraViewvector
		cv.cameraPosition=new Vec([this.transform_into_texture_space(C),this.UVmapping_Offest.concat(0)]) // pos point of camera relative to UV origin on st plane (so that we can use a texture atlas)
		cv.viewVector=this.transform_into_texture_space_m() // view vector  ( many vectors for one camera ? )

		//let tau=c[2]  /v[2]     // todo: use law of ascocitaten to change order of matrix mul and div
		// 2 -> 0,1
		for(let st=0;st<2;st++){
			// dependency on V moves this to cv.ViewVector (see two lines below): cv.cameraPosition.nominator[st]=cv.cameraPosition.nominator[st].scalarProduct(cv.viewVector.nominator[0][2]) // common denominator aka "homogenous coordinates" cameraPostion just stays	texel[st]=c[st]		 

			// the higher the camere, the farther we can see
			cv.viewVector.nominator[st]=cv.viewVector.nominator[st].scalarProduct(cv.cameraPosition.v[2]) // // +  tau * v[st]     
			
			// read from right to left: sense normal distance -> scalar, multiply with camera position (vector) as in the non _m method. This bottleneck with numbers becomes an outer product and creates a matrix for the defered evaluation
			// Ugly in concert with the st loop. Matrix.mul(cv.cameraPosition,cv.viewVector.nominator[2])   
			// try manually
			//for(let out=0;out<3;out++){ // todo : out is never used

			// 2 is the compontent which will be multiplied with the forward (z) component of the view vector which is 1. So it is just the bias, the const nom in the polynom
			// this is the uvz value for the nose view vector in the center of the screen. This is really a vector ( column in a matrix made of rows -- I just checked: build of rows is called row major . It is just confusing because in my Code and in Java, there then is no column, just fields / compontens of the row because rows and columns are vectors / arrays. They don't have their own name for the index.)
			cv.viewVector.nominator[st].v[2]+=cv.cameraPosition.v[st]   // [][2] (bias) is not to be confuced with [2] (denominator)
			//}
		}
		return cv.viewVector   // xyz   stz  convention. [2] actually is not a nominator, but denominator (when calcualting the cut)
	}
	
	transform_into_texture_space(v:number[],UV_offset?:number[]):number[]{
		const v3=UV_offset!=null ? new Vec3([v,UV_offset]): new Vec3([v])
		const coords=[0,0,0]
		coords[2]=this.normal.innerProduct( v3  )  // Error: this.normal is not defined
		for(let st=0;st<2;st++){  // this is actually a Matrix multiplication todo Matrix is not square.
			coords[st]=this.only[st].innerProduct( v3 )
		}
		return coords
	}

	transform_into_texture_space_m():Matrix{
		const m=new Matrix()
		m.nominator=[...this.only,this.normal]
		return m
	}


	// Camera below surface?
	backface_culling(){

	}
}



export class Mapper{

	// I love OOP and cannot stand functional paradigma for this
	image: HTMLImageElement;
	imageData: ImageData;
	texture_inspected: HTMLCanvasElement;
	source_width:number
	target_width:number
	frame= new SimpleImage();

	constructor(){
	
		// This is a prototype. I putt everything into DOM
		// release to Atari Jaguar!
		const texture_inspected=document.getElementById("texture") as HTMLImageElement
		if ( (texture_inspected  ).complete ) this.getImageData(texture_inspected)
		
		 //as HTMLCanvasElement	
		 // fires too late while debugging 
    	//this.texture_inspected.onload = this.getImageData  // Asset loading needs to move to top level

		//this.image.src = "texture.png";

		const frame_inspected=document.getElementById("Canvas2d") as HTMLCanvasElement
		this.frame.pixel=new Uint8ClampedArray(frame_inspected.width*frame_inspected.height*4)
		this.target_width=frame_inspected.width
		this.frame.height=frame_inspected.height
		// Elements are so fat, we pick cherries
	}
	putpixel(source: number[], target: number[]){
		//console.log("x",target[0])
		const s=(Math.floor(Math.abs(source[0])%64)+this.source_width*Math.floor(Math.abs(source[1])%64))*4
		const t=(Math.floor(target[0])+this.target_width*Math.floor(target[1]))*4

		for(let i=0;i<4;i++){
			this.frame.pixel[t+i]=this.imageData.data[s+i]
		}

		{
			const i=3
			this.frame.pixel[t+i]=255
		}		
	}

	getImageData(texture_inspected: HTMLImageElement) {  // binding

		this.texture_inspected = document.getElementById("texture_check") as HTMLCanvasElement
		this.texture_inspected.width = texture_inspected.width
		this.texture_inspected.height = texture_inspected.height
		const ctx = this.texture_inspected.getContext("2d")
		ctx.drawImage(texture_inspected, 0, 0)


		// an intermediate "buffer" 2D context is necessary

		//const ctx = this.texture_inspected.getContext("2d")
		//ctx.getContextAttributes()

		const obj = { pixelFormat: "rgba-unorm8" }  // dated lib.dom.d.ts?? 2025-07-18
		this.imageData = ctx.getImageData(0, 0, this.texture_inspected.width, this.texture_inspected.height, obj as ImageDataSettings);
		this.drawCanvas();
		this.source_width = texture_inspected.width  // no style on the image. Browser extracts size after loading the image
	}
	drawCanvas(){
		const canvas = document.getElementById("Canvas2d") as HTMLCanvasElement;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.putImageData(this.imageData, 0, 0);console.log("put Canvas2d") // works
		}
	}
	drawCanvasGame(){
		const canvas = document.getElementById("Canvas2dGame") as HTMLCanvasElement;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			//const obj = { pixelFormat: "rgba-unorm8" }; // dated lib.dom.d.ts?? 2025-07-18
			const imageData = new ImageData(this.frame.pixel, 320, 200);
			ctx.putImageData(imageData, 0, 0);console.log("put Canvas2dGame")
		}
	}
	

	span(){
			// no synergy in code. Deltas cost too much lines. Later?
			// Maybe start with "The hidden below": Do end points exaclty and then span. Then add Quake subspans?
	}

	affine(){
		// Span.render();
	}
	constZ(){ //On Jaguar due to pixel mode this seems to be fastest. Longest blitter runs. Lowest CPU burden. Fits into the Doom minimize overdraw and blitter command theme
		// this would need calculations above this for the horizon
		// also check if Jaguar can really draw diagonals.
		// to minimize splits, they better are only introduced when needed. For example tiles (2d vectors and decals) need splits anyway. Decals (examples: 5* , hexagon) need a beam tree
		// so we have the real const z which governs split (2^n spans). The approx const z ( horiztontal, vertical, diagonal ) for the blitter
		// even if diagonal does not work, the other two are more important anyway
	}
	/*
	subsivison(screen:Point_Tex2[]){ // guess I have to abuse the type system to mark the basis ( marker interface , attribute  :-(  )
		screen.sort(s=>s.point[1])
		let blocks=[(screen[1].point[0]-screen[0].point[0])>>3 ]
		if (slope ==0 || y[0]==y[1]) {
		// bounding box . Due to clipping on the screen borders .. Screen needs to be so that the control points span. have some border. Or yeah, let the grid snape 1 around. Only use
		}else{
			// try to fit a block in one of the three corners


		// I want a cheap transistion from affine to this ( and only use points inside )
		// Nobody sees any jumps in the heat of the action or due to stutters on vintage hardware
		// center grid on the bounding box

		blocks[1]=3 // todo find x min max
		// slope -> array of xs -> all corners as control point candidate -> fraction histogram  (in 2d)
		// merge leafs before blocks
		}
	}*/
}