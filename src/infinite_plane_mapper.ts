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
	cameraPosition: Matrix
	viewVector:Matrix
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
		this.z=[S.v[2],T.v[2],0]  // not affected by clipping. No flipping around of chosen vertex with adjacent edgesr to invert
		let n=S.crossProduct(T)
		this.normal=n.scalarProduct(1/n.innerProduct(n)) as Vec3  // uh I need special scalar Product to avoid typeCast ??!
		let coupling=S.innerProduct(T)  // symmetric
		let ST=[[S,T],[T,S]] // pointer even in JS ( and Java, and C#, and please in JRISC -- or loop unroll)
		this.only=ST.map(st=> st[0].subtract(  st[1].scalarProduct(  coupling / st[1].innerProduct(st[1])  )  ) as Vec3)
		for(let i=0;i<this.only.length;i++){
			let effect_of_1st=this.only[i].innerProduct( ST[i][0] )
			if (Math.abs(effect_of_1st)>0.001) this.only[i]=this.only[i].scalarProduct(1/effect_of_1st) as Vec3
		}
	}

	UVmapping_fromST=[[1,0],[0,1]]  // can load uv mapping into this: z needs to be generated
	UVmapping_Offest=[0,0]

	generate_payload(C:number[],V:number[]):number[]{
		let factor_on_the_right=this.infinte_checkerBoard(C,V)
		let pl=([this.z].concat(this.UVmapping_fromST).map(p=>p.reduce( (s,c,i)=> s+c*factor_on_the_right[i])))  // need a way to transform this into gradients for rasterizer

		return pl
	}

	uvz_from_viewvector(C:number[]):Matrix{
		let st_from_viewvector=this.infinte_checkerBoard_m(C)


		// the rest should result in new PixelShader( at_bottomRight_of_Center, gradient )  // InfiniteCheckerBoard is PixelShader
		// view vector has fixed z component => at_bottomRight_of_Center


		// UV mapping to harmonize st with z : none is aligned with any of the edges ( only by luck )
		// UV mapping is great to map one rectangular texture onto a mesh
		// But we don't depend on it here.
		// what mesh?    // First occurence of matrix mul. Not sure about interface. Clearly I need this for rotation (frame to frame), and generally transformation (within frame)
		let uvz_mapped=new Matrix()
		// the first row is the w component of homogenouc coordinates. It feeds the 1/ve[2] through
		uvz_mapped.nominator=	[new Vec3( [[0,0,1]] ) ].concat( this.UVmapping_fromST.map(p=>new Vec3([p])) , new Vec3( [this.z] ));
			// Everone uses the general proof that 1/z is linear in screen space (far plane can be substracted.). Sorry that I cannot utilize my: "just calculate with fractions as in school!"
			// Linear allows for an offset. So 0 does not need to be the horizon. Together with scaling there are two degrees of freedom which can change from polygon to polygon
			// Do polygons bring their far-plane along? Perhaps due to vertex position
			// for inter-polygon comparison ( z-buffer ) we need a standard. So the multiplication with [s.z,t.z.0] 
			// with viewVector should fix scaling
			// with cameraPostion should fix offset  ( both indirectly through cv.nominator)
		let uvz_from_viewvector=new Matrix //CV
		uvz_from_viewvector=Matrix.mul( [uvz_mapped.nominator, st_from_viewvector.nominator]  )
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
		return uvz_from_viewvector
	}

	infinte_checkerBoard(C:number[],V:number[]):number[]{
		let c=this.transform_into_texture_space(C,this.UVmapping_Offest.concat(0)) // pos point of camera
		let v=this.transform_into_texture_space(V) // view vector  ( many vectors for one camera ? )

		let tau=c[2]/v[2]     // todo: use law of ascocitaten to change order of matrix mul and div
		let texel=[0,0]
		for(let st=0;st<2;st++){
			texel[st]=c[st] + tau * v[st]     
		}

		return texel
	}

	// like mode-z on SNES (tm)
 	infinte_checkerBoard_m(C:number[]):Matrix{
		let cv=new CameraViewvector
		cv.cameraPosition.nominator[0]=new Vec([this.transform_into_texture_space(C),this.UVmapping_Offest.concat(0)]) // pos point of camera relative to UV origin on st plane (so that we can use a texture atlas)
		cv.viewVector=this.transform_into_texture_space_m() // view vector  ( many vectors for one camera ? )

		//let tau=c[2]  /v[2]     // todo: use law of ascocitaten to change order of matrix mul and div
		// 2 -> 0,1
		for(let st=0;st<2;st++){
			// dependency on V moves this to cv.ViewVector (see two lines below): cv.cameraPosition.nominator[st]=cv.cameraPosition.nominator[st].scalarProduct(cv.viewVector.nominator[0][2]) // common denominator aka "homogenous coordinates" cameraPostion just stays	texel[st]=c[st]		 
			cv.viewVector.nominator[st]=cv.viewVector.nominator[st].scalarProduct(cv.cameraPosition.nominator[0][2]) // // +  tau * v[st]     
			
			// read from right to left: sense normal distance -> scalar, multiply with camera position (vector) as in the non _m method. This bottleneck with numbers becomes an outer product and creates a matrix for the defered evaluation
			// Ugly in concert with the st loop. Matrix.mul(cv.cameraPosition,cv.viewVector.nominator[2])   
			// try manually
			for(let out=0;out<3;out++){
				cv.viewVector.nominator[st]=cv.viewVector.nominator[st].subtract(cv.viewVector.nominator[2].scalarProduct(-cv.cameraPosition.nominator[0][st]))
			}

			// v[2] is left as "w"" to defer the division
			// but why does payload want to multiply with the z components of s and t?
		}

		// the moment we expand the denominator to cameraPosition, the const is gone. Const is due to untronsformed viewVector[2=z] = 1
		//cv.cameraPosition.nominator[0]=[cv.cameraPosition.nominator[2]] // independent of View. Position already incorporated. => only a vector. Not a matrix

		return cv.viewVector  // v[2] is 1/z aka w   c[2] needs to be multiplied with v
	}
 
	transform_into_texture_space(v:number[],UV_offset?:number[]):number[]{
		let v3=UV_offset!=null ? new Vec3([v,UV_offset]): new Vec3([v])
		let coords=[0,0,0]
		coords[2]=this.normal.innerProduct( v3  ) 
		for(let st=0;st<2;st++){
			coords[st]=this.only[st].innerProduct( v3 )
		}
		return coords
	}

	transform_into_texture_space_m():Matrix{
		let m=new Matrix()
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
		const s=(Math.floor(source[0])+this.source_width*Math.floor(source[1]))*4
		const t=(Math.floor(target[0])+this.target_width*Math.floor(target[1]))*4

		for(let i=0;i<4;i++){
			this.frame.pixel[t+i]=this.imageData.data[s+i]
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
		this.source_width = texture_inspected.width  // no style on the image. Browser extracts size after loading the image
	}
	drawCanvas(){
		const canvas = document.getElementById("Canvas2d") as HTMLCanvasElement;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.putImageData(this.imageData, 0, 0);
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