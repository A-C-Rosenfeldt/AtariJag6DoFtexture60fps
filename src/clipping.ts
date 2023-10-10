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
	mul(trans:Vec[]):Matrix{		
		let res=new Matrix()
		for(let i=0;i++;i<this.nominator.length){
			res[i]=this.nominator[0].innerProductM(trans,i)  // base would want vector add, while JRISC wants inner product
		}
		return res
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
	position:Vec3
	rotation:Matrix // this needs to be matrix. I tried to appreciate jagged arrays once and used vectors. It did not work out. Think of two dimensional array here ( C, C++, C#, JRISC) 
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


	inverse:Matrix

	rotate(){
		this.inverse=this.

		
	}

	// pre multiply matrix or not? 
	pixel_projection_texel(pixel:number[]){
		var backwards_ray=new Vec3( [[ this.fov,pixel[0]-screen[0]+.5  , pixel[1]-screen[0]+.5 ]] )
		this.rotation.mul([backwards_ray])
	}

	const fov=256 // It hurts me that magic values help with float. OpenGL runs on float hardware and combines this into one Matrix
	// I need a start pixel of the polygon for the rasterizer
	// I know that it feels weird that edges and texture are then projected backwards
	vertex_projection_pixel(forward_ray:Vec3){
		let m=new Matrix()
		m.nominator=[forward_ray]
		let fr=m.mul(this.rotation) ; // Todo: Right-Mul?  Vec.Mul() ?

		let pixel=[ Math.floor(fr[1]*this.fov/fr[0]), Math.floor(fr[2]*this.fov/fr[0]) ]
	}

	vertex_projection_clip(forward_ray:Vec3){
		for(let side=0;side<2;side++){
			var pyramid_normal=new Vec3([[ -160, this.fov,0]]) //-160, -220 )
			let nr=this.rotation.mul([pyramid_normal])
			forward_ray.innerProduct(nr)
		}
	}

	edge_projection_clip(origin){
		for(let x=0;x<2;x++){
			for(let y=0;y<2;y++){
			}			
		}
	}

	c:CanvasCaptureMediaStreamTrack;
	transform_ray_backwards(vec:Vec3):Vec3{
		for(let i=0;i<3;i++){

		}
	}

	mul(b:number[][],v:Vec3):Vec3 {
		for(let i=0;i<3;i++){
			inner
		}
	}

	inverse:Vec3[]
	denominator:number
	set_rotation(r:Vec3[]){
		this.rotation=r
		this.inverse=new Array<Vec3>(3)

		for(let i=0;i<3;i++){
			var t=r[(i+1)%3].crossProduct(r[(i+2)%3])
			for(let k=0;k<3;k++){
				this.inverse[k].v[i]=t[k]
			}
		}
		this.denominator=r[2].innerProduct(t)  // For rounding and FoV / aspect ratio (no normalized device coordinates)
	}

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