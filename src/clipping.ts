/**
 * Regarding occlusion culling I seem to have two alternatives. After clipping to frustum in screen space even older hardware can give me 16 bit per ordinate, so 8.8 fixed point.
 * Yeah, 8 bit hardware may really need to stick to adaptive precision integers. So if I dual release plus4 and Jag?
 * It is not really a beam tree then anymore. Just a 2d tree. Binary area subdivision.
 * Without more precision I cannot subpixel decide on the circular order of cuts. Everything will have to be rounded first.
 * We only care about the rays, not the space between. These BSP unsuited areas become child nodes in the tree.
 * I still seek a general Theory where a profiler changes from tree, to scanlines with spans, to z-buffer ( at a small enough are, this will be fastest. Though it costs code size.
 */

/*
World space occlusion culling, really only makes fun with frustrum rotating in world space. No vehicles (not even polygon monsters) . Bookkeeping is not thaaat bad.
If I precalculate world space occlusion data structures like BSP or portals, I cannot allow rounding errors.
Though a loose bounding volume hierachy can specify padding which is good enough until the far plane.
This yields false positives but, would do something in camera space about this overlaps.
On the other hand it would be cool if vehicles -- even if we cannot enter them -- would solve self occlusion ( shadows ) internally first.
*/


// no native vectors in JS. Buffers are for large data (also called vectors)
// I need vec3 and only two products
// I don't want external dependencies of fat because I later need to compile to JRISC

class Vec{ // looks like I need 2 and 3 dimensions to show off this (adaptive) linear approximation trick for textures after persepective projection 
	v:number[]
	innerProduct(o:Vec):number{
		let sum=0
		for(let i=0;i++;i<this.v.length){
			sum+=this.v[i]*o.v[i]
		}		
		return 0
	}
	
	innerProductM(o:Vec[],k:number):number{
		let sum=0
		for(let i=0;i++;i<this.v.length){
			sum+=this.v[i]*o[i].v[k]
		}		
		return 0
	}

	//constructor(points:number[][],len)
	constructor(points:number[][]){
		if (points.length<2){
			this.v=new Array<number>(points[0][0])
		}else{
			this.v=new Array<number>(points[0].length)
			for(let i=0;i++;i<points[0].length){
				this.v[i]=points[0][i]-points[1][i]
			}
		}
	}
}

class Vec3 extends Vec{

	crossProduct(o:Vec3):Vec3{
		let v:Vec3=new Vec3([[this.v.length]])
		for(let i=0;i++;i<this.v.length){
			v[i]=o.v[(i+1)%3]*o.v[(i+2)%3]-o.v[(i+2)%3]*o.v[(i+1)%3]
		}
		return v
	}
}

class Frac{
	nom:number[]
	compare(o:Frac):boolean{
		return this.nom[0]*o[1]<o[0]*this.nom[1]
	}
	get_sign():boolean{
		return this.nom[0]<0 == this.nom[1]<0 
	}
}


class Matrix{
	nominator:Vec[]
	static inverse(spanning2d: Vec[]) {
		throw new Error("Method not implemented.")
	}
	inverse(m:Vec[]):Matrix_frac{ // see applications. May need to pull back here for unit tests
		return null;
	}
	// Matrix with vector shoud usually use the inner product for fast implementation in JRISC MMULT and for nice mathematical notation ( as opposed to the SUM sign Sigma)
	// So here the right Matrix is seen as a collection of vectors. Somehow this works great to interpolate, but badly for rotation.
	// Thinking of column major for the vector. We store along columns, we mmult along columns
	// But obviously here, Matrix is row major, and the vector is considered trans.
	mul_left(trans:Vec[]):Matrix{		
		let res=new Matrix()
		for(let i=0;i++;i<this.nominator.length){
			res[i]=this.nominator[i].innerProductM(trans,i)  // base would want vector add, while JRISC wants inner product
		}
		return res
	}

	// On the other hand, matrix multiplications is symmetric with respect to its operands. Vector.Inner_product feeld weird
	// This fits the A * A.inv() of SO3 very well
	// A * T(A) = 1
	// A*W_col -> C_col   ; T(A)*C_col -> W   <=> T(C_col)*A -> T(W) 
	// <=>
	// T(A*W_col) -> T(C_col)   ; T(A)*C_col -> W   <=> T(T(C_col)*A) -> W 
	// So I would store vectors in World space or Vectors in Camera space in different orientation? 
	// What if I never multiply two Matrices? ( I keep the division of the projection separated)?
	// I lose the symmetry. My code will be full of Transpose(). Ah no, Transpose is only for rotation .. nothing else. JRISC loves transpose. For others I could let the setter maintain the transpose.
	// BeamTree has only vector products. Texture mapping has inverse. Texture mapping is a beast: I need the product of the full projection matrix, the vertex interpolation, and the texture wrapping.
	// it goes like: Texel coordinate * texture rotation/scale * vertex position * rotation * projection .. and then inverse.
	// Inverse is slow. There is not point in swapping loops from inner to outer. No Transpose.
	// So weird that the unfied Vec4 approach of OpenGL has nothing on this
	// OpenGL goes forward over the vertices and then inverts on screen. They mix they near and far plane into this for the reason that linear interpolation without artefacts does not like large z dynamic.
	// So we do full precision z on the edge and then affine ( style of 1993 ). For sub spans, ah I get it. Interpolation is naturally an integer thing. We want to use the full machine integer range for this.
	// So both, texture subspans and z buffer, want the viewing frustum. It feels weird to keep dependencies for spans, like I would run along the span, and then suddenly will have to MUL to up the precision at one point,
	// or generally pull in more precision on a lot of.. But hey, grazing incidence is not suited to subspans. So I would fall back to full software and full precision, anyway.
	static mul(A:Vec[][]):Matrix{		
		let res=new Matrix()
		for(let j=0;j++;j<A[0].length){
		for(let i=0;i++;i<A[0].length){
			res[i][j]=0
			for(let k=0;k++;k<A[1].length){
				res[i][j]+=A[0][i][k]*A[1][k][j]  // base would want vector add, while JRISC wants inner product
				// for Vector Add, we want the last index select the component
				// So no matter what picture you have in your head ( row or column, left or right multiply),
				// Like in OpenGL Vectors would need to live in the right factor ( the inner loop ) as input
				// Output uses the other index
			}
		}
	}
		return res
	}	
}

// So some engines don't seem to care, but I care about rounding
// Now for Doom or portal renderers I need infinite precision to avoid glitches.
// clipping to screen borders makes more sense after rotation ( even without normalized device coordinates .. because I clip a lot against portals and beam tree, Screen borders are nothing special)
// Quake PVS is also in world space. I now understand modern raytracing: Polygons in camera spacen, pixels in world space
// real ray-tracing would be if I round rays to world coordinates, but this will kill Bresenham
// linerp in the blitter does not even care.
// Beam tree is so PVS like. I want it as graph and independent of rotation.
// How do I display this? With rotation I can draw the BSP on screen
// I should not care about the precision. I can switch the code later on, to use time coherence .. or even build bounding volumes for the camera
// All the math is 3d with some non-normalized vectors. But the edges can still be drawn on screen.
// So uh, okay fantasy world without rounding

class Matrix_Rotation extends Matrix{
	// for rotation matrices this is the same as multiplying with inverse
	// First version only uses vectors because beam tree has a lot of rays to trace which are not projected
	// I want to leak the implementation because I count the bits. It is research code!
	// transpose only confuses me with other Matrices
	// Looks like Quaternions and Rotation Matrix belong together, while other Matrices don't
	MUL_left_transposed(v:Vec):Vec{
		let res=new Vec([[0,0,0]])
		for(let i=0;i++;i<this.nominator.length){
			for(let k=0;k++;k<this.nominator.length){			
				res[i]=this.nominator[k][i] //.innerProductM(trans,i)  // base would want vector add, while JRISC wants inner product
			}
		}
		return res
	}

	// Controls rotate from left. Forward ray = transposed. After the original rotation. 
	// It only affects two oridinates
	// Only these need to be modified, but all be read
	// Only reason for this is here is this rotation!
	Rotate_along_axis_Orthonormalize(axis:number, sine:number[]){
		// rotate an normalize
		// orthogonal: 3 products. Correction is shared 50:50
		//let cosine=Math.sqrt(1-sine*sine)
		let n:number[][]
		for(let i=0;i<3;i++){ // left transpose = right normal? I do row major as normal. So second index [i] just goes through. Right index mates.
			let k=(axis+1)%3,l=(k+1)%3, n:number[], sqs=Math.pow(this.nominator[axis][i],2)
			for(let j=0;j<2;j++){ // Maybe I should have both versions available
				n[k][i]+=sine[0]*this.nominator[k][i]+sine[1]*this.nominator[l][i]
				k=l,l=(k+1)%3;sine[1]=-1*sine[1]
				sqs+=Math.pow(n[k],2)
			}
			let rsq=1/Math.sqrt(sqs) // see Quake for Taylor series
			n[k][i]*=rsq
			n[axis][i]=this.nominator[k][i]
		}
		let sums:number[]=[]	// So do I need a transpose?	
		for(let i=0;i<3;i++){
			let sum=0,j=(i+1)%3
			for(let k=0;k<3;){
				sum+=n[k][i]*n[k][j]
			}
			sums[i]=sum
		}
		for(let i=0;i<3;i++){
			let sum=0,j=(i+1)%3,l=(j+1)%3
			for(let k=0;k<3;k++){
				this.nominator[k][i]=n[k][j]
				if (k!=axis){
					this.nominator[k][i]-=sums[i]*n[k][j]/2
					this.nominator[k][i]-=sums[l]*n[k][l]/2
				}
			}
		}
	}
}


class Matrix_frac extends Matrix{
	denominator:number
/*  UV has no denominator .. super class suffices!
	mul(trans:Vec[]):Matrix_frac{
		let mf=new Matrix_frac()
		mf.nominator=super.mul(trans).nominator
		mf.denominator=this.denominator*trans.den
	} */
}


class Plane{
	anchor:number[]
	normal:Vec3
}

class Z_order{
	z_at_intersection(e:Vec3[], anchor:Vec, normal:Vec):Frac{

		let beam=e[0].crossProduct(e[1]) // edges are planes with a normal in a beam tree

		// normal.inner(l*beam ) = normal.inner( anchor ) 
		let l:Frac
		l[0]=normal.innerProduct( anchor )
		l[1]=normal.innerProduct( beam)

		return l
	}

	// not really useful probably
	get_cutting_edge(p:Plane[]){
		let direction=p[0].normal.crossProduct(p[1].normal)
		let delta=new Vec3([p[0].anchor,p[1].anchor]) ; // hmm todo
		let dump=p[0].normal.crossProduct(delta) ;

		let reach=p[0].normal.crossProduct(direction)


		// v=direction+reach[0]+reach[1]
		// inverse 
		// transpose
		//let r0=v.innerProduct(direction.crossProduct(reach[1])) / spat
	}
}

class Edge{
	constructor( anchor:Vec3, direction:Vec3){

	}
}

interface Split{
	get_rotation(edges:Vec3[]):number
}

class AroundVertex { //implements Split{
	get_rotation(edge:Vec3, vertex:Vec3):number{
		return edge.innerProduct(vertex)
		// the normal of the edge may point in any direction
		// gather information on all coners of the screen and look for changes of sign.
	}
}

class Edges implements Split{
	get_rotation(edges:Vec3[]):number{
		return edges[0].crossProduct(edges[1]).innerProduct(edges[2])
	}
}

class Player{ // Location is reserved by JS TS // also used for collision // I don't want to call it "Object" // Atari 2800!
	position:number[] //Vec3
	rotation:Matrix_Rotation // this needs to be matrix. I tried to appreciate jagged arrays once and used vectors. It did not work out. Think of two dimensional array here ( C, C++, C#, JRISC) 
	// for our retro systems, position is already relative to camera (thanks to scene graph .. rotation comes later)
	// we already clipped ( backwards renderer as opposed to forward rasterizer? )
	get_Position(){
		return this.position[0];//-this.camera
	}
}

class Vec3_frac extends Vec3{	
	d:number
}

// in a beam tree we compare world edges against enemies .. no need to pull in the camera too early.
// but then it feels like ray casting here. Let's just call it a raycasting engine. Fits in with Wolf3d on Jaguar ( and maybe even AvP )
// I had a fear that rounding leads to gaps at vertices, but with beam trees I feel a little more safe.
// Beam trees may crash due to rounding .. no matter if forward or backward. I think even texture mapping in beam tree may lead to 1/0 due to rouding. Forward just cannot help anymore
// Simple solution is to saturate values after we rounded to polygon-height and span width/px.
class Camera extends Player{ // camera

	/*
	OpenGl has this projection Matrix.
	But in a Beam-Tree (with infinite integers) we have separate code for position, rotation, Fov-clipping, and pixel projection


	*/


	const screen=[320,240]
	scale:number[]

	constructor(){
		super()
		this.scale=[]
	}




	// pre multiply matrix or not? 
	pixel_projection_texel(pixel:number[]){
		var backwards_ray=new Vec3( [[ this.fov,pixel[0]-screen[0]+.5  , pixel[1]-screen[0]+.5 ]] )
		this.rotation.mul_left([backwards_ray])  // I support both directions of rotations nativeley because that is how I think of them, generally (when solving equations, or physcs, or synergy with HBV). SO3 just does not have a common denominator in neither direction.
		// something position?
	}

	const fov=256 // It hurts me that magic values help with float. OpenGL runs on float hardware and combines this into one Matrix
	// I need a start pixel of the polygon for the rasterizer
	// I know that it feels weird that edges and texture are then projected backwards
	vertex_projection_pixel(vertex:number[]){
		let forward_ray=new Vec3([vertex,this.position])
		let fr=this.rotation.MUL_left_transposed(forward_ray)
		let pixel=[ Math.floor(fr[1]*this.fov/fr[0]), Math.floor(fr[2]*this.fov/fr[0]) ]
	}

	// very similar to Jaguar SDK. Guard band clipping only bloats the code.
	// actually, JRISC only has unsigned DIV. So we are forced to clip the near plane beforehand (no divide by zero). We are also forced to skew and make two sides of the screen axis aligned. Then again: clip using the sign.
	// Also to use full precision of DIV ( which sets no flags ), in fixedPoint mode, I need to make sure that the result does not overflow fixedPoint.
	// like 100 / .01 expands the envelope!
	// Actually we have no x much larger than z after rotation. The large part is shift before DIV.
	// To clip both other screen borders before the shift, we only MUL with 5 ( for 5*64=320 ) and 15 ( 16*15=240 ). So ADD/SUB SHL ADD. Ah oh just go ahead with MULT
	// OpenGL thinks that clipping is so very important and MMULT in such a way that it can clip at diagonals ( but no clipping to portals? )
	// using simple CMP or ADC, and move.
	// Transformation to screen space uses those small factors (1+4 and 16-1) and the SHL; DIV. 
	// short refresher: After transformation we don't store 1/z, but we subtract the far plane to use the whole scale (and that is the only reason: Memory is expensive!).
	// this gives us a far plane. I see how 1/z still has to be linear after this substraction
	// Perspective correction works by using W also for UV just as for the other coordinates. W is the unbiased Z and U and V have not been transformed.
	vertex_projection_clip(forward_ray:Vec3){
		var clipcode:number[]=[]
		for(let side=0;side<4;side++){
			var pyramid_normal:Vec3
			if (side&1){
				pyramid_normal=new Vec3([[ side&2?-160:160 ,0, this.fov]]) //-160, -220 )
			}else{
				pyramid_normal=new Vec3([[ 0,side&2?-120:120, this.fov]])
			}
			let nr=this.rotation.mul_left([pyramid_normal]) // forward or backwards? I dunno
			clipcode[side]=forward_ray.innerProduct(nr[0])
		}
		var plane:number[]=[] // near and far
		clipcode[5]=forward_ray[0]-plane[0]
	}

	// Todo: Find my text about this. I only use rotation matrix to be able to debug this
	// BeamTree language. Precision is no problem
	edge_clip(origin){
		// planes form a BSP, which breaks symmmetry
		// we go down the BSP. As long as both vertices fall into the same child, no problem
		// and edge is split each time we go down a node
		// we use the backwards vectors in the corners of the screen ( and near an far) and one base of the edge and the edge itself
		// to determin in which child of the BSP the cut ends up
		for(let x=0;x<2;x++){
			for(let y=0;y<2;y++){
			}			
		}
	}

	triangle_clip(){
		// BSP again
		// all vertices .. okay
		// edge cuts .. okay
		// we now only care for the frustum, no other child in the BSP
		// when we cut in a new plane in the BSP, now the roles are reversed. The inner-BSP edges can stick through the triangle
		// actually it would make more sense to have the triangle-cut edge within a BSP tree
		// when a new plane goes it, its cut within the concave sector may cut with the other cut
		// it is a 2d problem. Cut happens when seen from each edge, the other has vertices on both sides.
		// Ah I see, how I avoided the fractions in the past
		// the 3d way is to form volumes with all edges in clockwise rotation. All positive: we are in.
		// Though at this point we need this decision only for triangles which cut of a 3d (rear) corner of the frustum.
		// With more viewing distance than level loading, pure topological arguments suffice. I thinkt that is what I write in some text somewhere in this project.
	}

	denominator:number
	// set_rotation(r:Vec3[]){
	// 	this.rotation=r
	// 	this.inverse=new Array<Vec3>(3)

	// 	for(let i=0;i<3;i++){
	// 		var t=r[(i+1)%3].crossProduct(r[(i+2)%3])
	// 		for(let k=0;k<3;k++){
	// 			this.inverse[k].v[i]=t[k]
	// 		}
	// 	}
	// 	this.denominator=r[2].innerProduct(t)  // For rounding and FoV / aspect ratio (no normalized device coordinates)
	// }

	// top left rule  helps us: We don't change rounding mode. Ceil, Floor, 0.5 is all okay. Only 1-complement cut off ( towards 0 ) is not allowed. So be careful with floats!
	transform_vertex_forwards(ver:number[]):Vec3_frac{
		this.mul
		let screen=new Array<Frac
		y=div // for for loop across scanline
		// for Bresenham
		nominator[]
		z=
	}

	// todo: some weird OOP pattern to shift direction of transformation. Mix with a custom number type which can be fixed, float, variablePrecision

	y_at_intersection(e:Vec3[]):Frac{
		if (e[0].id==border_top) {y=border_top;return} // portal renderer  or  even BSP with coverage-buffer wants this

		let beam=e[0].crossProduct(e[1]) // edges are planes with a normal in a beam tree
		this.transform_vertex_forwards(beam)

		beam[1]/beam[2]

		return l
	}

	get_spanX_at_y_clipped(edge:vec3,y:number):number{  

		// so backward forward? This works for clipped edges. This is similar to the texture-mapping short cut. It is important for the variable precision graph.
		transform()
		let normal=x[1] cross x[0]
		// non-normalized  device, so we can just
		view_ray.crossProduct(normal)
		// first scanline ys

	}

	get_spanX_at_y_vertices_on_screen(edge:vec3,y:number):number{  
		let x= 2 // first scanline
		// I should prefer forward to stay in line with OpenGL
		let slope=x[1]-x[0]  
	
		// both also as integer
		x_int+=slope_int+bresenham(slope_frac) 

	}

	transform_edge_forwards(ver:number[][], screen_border_flags:number ):vec3{

	}	
}

class Point_Tex2{
	point:number[]
	tex:number[]

}

class Texture{ // similar to (clipped) edge
	p:Polygon // reference .. bidirectional .. I may need to pull some data like base:
	base:number[] // texture (0,0) in space .. So not so great for environment mapping, but really great later maybe for triangles which are extended into perfectly flat, not necessarily concave polygons
	// Material texture (tiles) should not be squeezed .. but UV unwrapped organic texture (globe) needs to
	spanning:Vec3[]
	innerLoop:number[][] // scree{x,y} -> u v denominator  // the dependency graph may depend on clipping. The form of the function is independent from it.
	constructor(vertex:Point_Tex2[]){ 
		if (clippling){ // point array count=2  // important for level . Perspective correction is mandatory to differentiate the Jag from 3do and PSX
			this.base=vertex[1].point

			// inverse within a plane at least gives us a more simple determinant in the denominator .. hm lenght(cross product) . So somehow we now have a square-root here?
			// nominator xyz * innvers = uv  . not square.
			// linear equations. It does not help to omit the normal. Just cut off the line of the matrix in the end.
			/*
				Here is the geometric version
			*/
			for(let i=0;i<2;i++)
				this.spanning[i]=new Vec3(vertex.slice(0+i,2+i).map(p=>p.point))
			let camera:Vec3
			let normal=this.spanning[0].crossProduct(this.spanning[1])   // length should not matter .. inverse does not care. 
			this.spanning[2]=normal // feels as silly as the 1/z in the forward path . This screams for float .. or at least reinforces the fact that edges in a level should be about 1m long. 1mm cammera precision, 1km level ( or viewing distance??)
			//let hasToBeCoverdBy1=this.spanning[0].crossProduct(normal).innerProduct(camera) // just the inversion equation (transpose is a bit hidden? With inner product here the other direction needs left multiply)
			//let denominator=this.spanning[0].crossProduct(normal).innerProduct(this.spanning[0]) // obviously gives 1 when needed
			
			// I need height anyway (whatever "unit"). So 3x3 inverse. Then transform both (same unit) camera position and viewing direction into this. Then triangle divide as in checker board.
			// The normal is hence justified. Maybe I could compile the level and find small normals.
			// multiply with spanning UV

			// inverter , check for normel.cross => early out 0
			// spanning is vectorAdd . We don't need to transpose. Inverse is already innerP.
			let inverse=new Matrix_frac
			for (let i=0;i<2;i++){
				let v=this.spanning[(i+1)%3].crossProduct(this.spanning[(i+2)%3])
	
				inverse.nominator[i]=v //.inverse(spanning2d)
			}		
			inverse.denominator=inverse.nominator[0].innerProduct(this.spanning[0])	// count down in the loop above to have the values in registers
		}else{ // imporant for high detail enenmies and affine texture mapping on small triangles
			/*
			2d 
				spanning Points
				invert  . Only place with 2d invert
			*/
			if (affine){ // check if (delta z^2)/2 * (x+y ) < threshold ( value)  or cost : block division?
				let spanning2d=new Array<Vec>(2)
				for(let i=0;i<2;i++){
					spanning2d[i]=new Vec([vertex[i+1].point,vertex[0].point]) // temporary
				}
				let inverse=new Matrix_frac
				for (let i=0;i<2;i++){
					let v=new Vec([[2]])
					v[0+i]=-spanning2d[1-i].v[1-i]
					v[1-i]=+spanning2d[0+i].v[1-i]
					inverse.nominator[i]=v //.inverse(spanning2d)
				}
				inverse.denominator=0
				for (let i=0;i<2;i++){				
					inverse.denominator=spanning2d[0].v[0+i]*spanning2d[1].v[1-i]-inverse.denominator
				}				
				// todo: tests from CPU sim
				// UV
				for(let i=0;i<2;i++){
					spanning2d[i]=new Vec([vertex[i+1].point,vertex[0].tex]) // temporary
				}		
				let deltas=inverse.mul(spanning2d)

				//

			}else{
				// do I really want this?
				U=U/Z
				V=V/Z
				W=1/Z  // this looks so artificial compared to the other branch
			}
			
		}
	}
}

class Mesh{ // static
	// Left edge structure
	// BSP
	// recursion
	//// strict BHV
	//// accelerate rough front to back heap-sort ( or queue sort) 
}
class Level{

}
class Enemy{

}
class World{ // dynamic
	camera:Projector
	level:Level
	enemy:Enemy

	
}