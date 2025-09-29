import { Vec2, Vec3, Matrix2, Vec2_den, Matrix } from "./clipping"
import { Edge_w_slope, Item, Point, Vertex_in_cameraSpace, Vertex_OnScreen,Corner } from './Item'

interface Pyramid {
	//logic
	corner_count(b: number[]): number
	//vector
	corner_ray(corner: number): Vec3
	border_normal(border: number): Vec3
	is_edge_inside_corner(): number
}

// special case: All vertices are Corners, and all edges are null
class Rectangle implements Pyramid {
	is_edge_inside_corner(): number {
		inside = bias
		for (let axis = 0; axis < 2; axis++) {
			if (this.FoV[axis] > 1) throw new Error("These factors only let the uses Fov expand a little inside the 45° pyramide from the coarse check")
			inside += corner_screen[axis] * this.FoV[axis] * cross.v[axis]       // So, how does this work with portals? Portals behind portals corners created by a cut between two edges (with rounded 16 bit screen coefs). The cut is not rounded


		}
	}
}

// This is for future code to check per pixel "ray tracing" as an exception for abs(value) < uncertainty
class Uncertain {
	value: number
	uncertainty: number
}

// New
// we look forward -- no FoV>180 no matter the shape. So the most independet thing to do is first to check if line going through both vertices passes in front of us
// so the z plane is back because at least one vertex need to have positive z
// any line will be in positive z -> so this is no test . The actual test is at the end of this paragraph and rather expensive
// the portal is already projected. It is 16 bit. The polygon vertices are still 3d (and I want large z) so they are around 24 bit
// The multiplication is still kinda cheap.  16x14 sha 16x14 add  store the sign bit somewhere ( shr to remove other bits; shl packet to make space OR to combine)
// so we know through which faces of the pyramid the edge passes through .. candidates
// My check was to expand the edge and camera into a surface. The pyramid edges (rays) then have an elevation
// The edge passe through fades where the elevation changes. Why do we need candidates? Is it only to discriminate against vertex-border ? Probably was a stupid bug in my old(prior to portals) code
// Now how to I detect lines, whose surface cuts through the pyramid, but not the line itself
// One half of the surface lies in negative z. I can shot a ray along the negative z axis, just deviating minimally ( some normal projection stuff ) 
// Ah this is a double cross product? These feel weird. I converted these equations to cross and then subtract inner product
// camera x edge_slope => normal   . normal x cross slope => shortest direction from camera to edge .  If the z component is negative then cull!
// compensation formulation:    vertex[0].z - slope.z*(vertex[0 | slope ) / (slope^2)    // 24x24 MUL because it is in 3d  . The DIV becomes MUL , of course
// Even though BSP mergers may come. Probably (for low poly) 3d polygon into 2d portal will be the normal case. BSP MVP will add poylgons sequentielly. Multi-Edge rasterizer -> mostly binaray tree. The DMZ thing did not pan out yet, mostly due to slithers: 3 almost parallel lines. The only vailable solution is indeed infinite precision. We have all the coefficients in scratchpad memory. We just need to add the products of the lower bits ( signed with some overlap to postpone carry )

// OLD: I never start from a portal. Always scrren rectangle as start and then a cascade of portas. So Horizon edges at least end in On_the_border_vertices, which may help with debugging
class Portal implements Pyramid {
	FoV:number[]
	constructor(half_screen:number[]){
		this.FoV=half_screen
	}
	// 2 or 3 item, 2 vertices
	classify23(items:Item[],v3:Vertex_in_cameraSpace,b:number){ // v3.outside_of_border|=1<<b
		items.forEach((item,i)=>{			
			let p3:Vec3
			// todo: switch
			if (item instanceof Corner) p3=new Vec3([[...this.FoV,100]])  // this is real. Corners don't need subpixel. But I will not invest in a separate code path
			if (item instanceof Vertex_OnScreen) p3=new Vec3([[...item.position,1000]])    // rounded, so a little cascade // todo 1000 is screen*(fraction=subpixel)/foV 

			const normal=p3.crossProduct(p3)  // two vertices. => 32 bit !!! This is t After projection the wedge product is only 16 bit. Not just due to the removed z, but 
			// 3d vertex is 32 bit  , well 24 . What if a polygon is split by a BPS? I clearly only want this effort on the real, outermost portal. If I stick to corners I can save a lot of code
			const only_sign_matters=p3.innerProduct(new Vec2([v3.inSpace]) ) // vertex-camera -> vector !! Then stick to it
			// how much code is this anyways? Does 16x32 rotation give me signed vectors?
			// imult, imac, imac, resmac    3 of these
			// carry  (read this from bottom to top):
			//    cpy low,high
			//    SAR  15,high      // two register shift.                         the sign of the product of the lows
			// 	  signed low word assumes that its expanded sign bits are added to the high word
			//		CMP -1,low  single out sign  -- same as sub for carry     the sign left in the stored low result
			//		ADC low,high  // compensate
			// ; clean low
			//	SHL 17
			//  SAR 17   ( even the 16 bit factors pulled in by MUL need leeway for the carry inside MAC)
			
			//    imult low, 1   // this alone is not enough. Think of BigInt, not fractions. 
			//

			v3.outside_of_border|=1<<b
		})
		
	}

	// 2 or 3 item, 2 vertices
	cut23(item:Item[],v3:Vertex_in_cameraSpace[]){
		
	}


	private cut_wedge(item: Item) {
		const vec2 = new Vec2([[2]])
		const p = (item as Vertex_OnScreen).position
		const w = [-p[1], p[0]]
	}
	// We calculate cuts because even the direct way doe it. just it only has one division
	// divisions are always the same cycles. So make them give us 16bit ordinates (8.8), which we need for the rasterizer anyway.
	// floats would be cool, but also difficult to debug. Perhaps local memory for data should be used to keep code size down -- so much norm add shift
	cut(item: Item[][]): number[] {
		if (item[0][1] == null && item[1][1] == null) {
			if (item.map(it => it.reduce<boolean>(
				(p, i) => p && ((i == null) || (i instanceof Vertex_OnScreen)), true)
			)) {
				// Just use 16 bit vertex coords

				// Trying to invert without actually writing this word here. Somehow express as wedge product and right multiplication?
				// Is this duality? Or axial vectors? The fact that math somehow makes me keep around slope and gradient vectors

				// for vertex -> border the item order around the polygon might not fit. Local reverse here!
				const slope = new Matrix2()
				slope.nominator = item.map(it => {
					const v = new Vec2([(it[2] as Vertex_OnScreen).position, (it[0] as Vertex_OnScreen).position])
					// const grad=new Vec2([[2]])
					// grad.v=[-v[1],v[0]]
					return v
				}
				);

				const grad = new Matrix2()
				grad.nominator = item.map(it => {
					const v = new Vec2([(it[2] as Vertex_OnScreen).position, (it[0] as Vertex_OnScreen).position])
					const grad = new Vec2([[2]])
					grad.v = [-v[1], v[0]]   // wedging . Todo check sign. Was this convention okay? Ah I think Bresenham breaks the sign anyway. So lets keep this convention because it feels natural in my head.
					return grad
				}
				);
				// we always have grad. Sometimes form vertices, sometimes directly from horizon

				const vertex_involved_count: number = 1// works for vertex-border thanks to reverse above
				// use wedge product to check if the vertices of the other edge are both on the same side. No dependency on rotation order
				// new . Todo: write as early out (classic for, extract into function, return) and also skip the edge

				// if one of the edges is horizon, us it for this and don't loop. If both are horizon .. uh the generic math problem . We cannot cull and it don't need to (to avoid glitches). We alredy checked if something is a horizon? Did we? Ah, only for the portal. The new polygon is .. uh so we check the vertices in 3d and 2d? 3d needs to be as precise to avoid . At least the portal is classified. The algorithm looks better in symmetric fashion.
				//  for the order of cuts, at least in 2d I already floated the slope ~= gradient for max precision and no influence from z. 
				// 3d edge vs Beam is problematic due to rounding. Even with reactangle I basically clip twice ( second time after rounding the slope ).
				// 3d vertex vs beam is possible, but imperfect. we get a lot of portal edge candidates. If I later implement BSP merging, I need symmetry anyways.
				// my symmetric pyramid clipping code feels like it has holes. I get candidate beam faces for cuts, but with vertices far on the side, all faces are candidates. Does this lead to glitches?
				// The beam edge cross polygon edge volume still gives me the actual face ( see corner code) . I don't understand how this could ever have glitched? Do I need to paint edges? Only case is when vertices are on the same side (see next code), but I extrapolated the edge. If I miss a corner, the corner traces will all ahve the sime size ( pyramid corner height over polygon "ground").
				let same_side = false
				item.forEach((polygon, i_grad) => {
					let point_of_view_found = false
					polygon.forEach(this_vertex => {
						if (this_vertex instanceof Vertex_OnScreen && !point_of_view_found) {
							point_of_view_found = true   // this allows for v-v  and v-s  for "this"
							let side_p = 0
							item[1 - i_grad].forEach(other_v => {
								if (other_v instanceof Vertex_OnScreen) {  // I don't do it for "virtual" vertices because it would mean a chain calculation ( complicated (rounding) error propagation)
									const side = grad.nominator[i_grad].innerProduct(new Vec2([other_v.position, this_vertex.position]))
									if (side_p == side) same_side = true  // this is  return  for the algorithm, but how to express in funcitonal?
									else side_p = side
								}
							})
							if (side_p!=0 && !same_side){   // on_Screen  -slope-> border  fits in this code in nicely .   // this allows for v-v  and v-s  for "that"
									const edge=null // dummy. Todo fiddle with the indeces!
									if (edge instanceof Edge_w_slope){   // while crafting the display list, the signs in slope have a meansing!
										const side=grad.nominator[i_grad].wedgeProduct(edge.gradient)   // Not for horizon
										if (side_p == side) same_side = true  // this is  return  for the algorithm, but how to express in funcitonal?
										else side_p = side										
									}
							}
						}
					})
				});   
				// old
				if (vertex_involved_count > 0 && parts_carried_by_basis_vector.v.reduce((p, c) => p || Math.sign(c) < 0, false)) return null  // cut is on the outside of either edge. Think of it as a triangle. Delta is the basis. Polygon order wants the cut to be corner C . Also need to point up both of them.
				if (vertex_involved_count == 2) {  // using the other vertices. Same triangle argument. Somehow I feel like I should check both other vertices relative to one of mine if they are on the same side of me. This is just early out. Perhaps a way to test the code for the 3d case? Area between cuts sign should give the saem result. I just do this because cuts are really expensive (in JRISC). Code size is not even the worst aspect here.
					let arg = item.map(it => (it[1] as Vertex_OnScreen).position)
					const delta = new Vec2(arg)
					const parts_carried_by_basis_vector = grad.mul_left_vec(delta)
					if (parts_carried_by_basis_vector.v.reduce((p, c) => p || Math.sign(c) < 0, false)) return null
				}


				///// This code may duplicate some math, but it needs to stay readabl? 

				// new
				// so now, a slope vector  inner product  gradient vector  is 0 if with its dual, but wedge product if cross. I keep these arround for all edges of polygon and portal ( size of the total state of cuts() )
				// How do we describe a cut? There is this relative vector between the bases. Bias looks ugly
				// a cut is zero on grad is inner prod=> easy . But what is inversion here? How can xy be a result of two inner products ( the multiplication of the inverse matrix)
				// from algebra we know: xy = wedged,transposed &* gradient &* (bias=delta vector )
				// reverse reading
				// decompose delta vector
				let arg = item.map(it => (it[0] as Vertex_OnScreen).position)
				const delta = new Vec2(arg)				// cuts are stored per portal and polygon. For portal-polygon cutting, we have nxm delta. This is similar to how we compare each edge with every corner
				//  into parts orthogonal to each line   => gives us the abstract s,t coords similar to texture mapping
				const parts_carried_by_basis_vector = grad.mul_left_vec(delta)   // not normalized     // return from here if any basis vector starting from VertexOnScreen is negative! How to share code with horizon? What is the equivalent ot the mul only check on the corners? It is the area between 3 cuts. So actually, do we really have to do nxm cuts with rounding? With vertex on screen, we can decide by the sign. Corner is a vertex on screen here ( OOP inheritance). Likewise vertices of the polygon need to be on different sides of the beam-plane.
				const de = grad.nominator[0].innerProduct(slope.nominator[1])  // determinant = denominator to normalize the parts vector. This obviously scales with the length of our basis vectors. The formula for inverse tells us that this is correct. Physics units would be m^2 and compensates both products
				if (de == 0) return null





				// add up the basis vectors    // this only needs a scalar factor per basis vector
				const xy_rel = Matrix.mul__Matrices_of_Rows([[parts_carried_by_basis_vector], slope.nominator])  // adding up vectors brings up back into the xy coordinate system. Matrix of Rows looks weird as static method
				const xy = xy_rel.nominator[0].scalarProduct(1 / de).apply((item[0][0] as Vertex_OnScreen).position)  // I have 3 point types: 3d, 2d, ah and 2d with an interface for the rasterizer: integer_part_of_y_()
				return xy   // if we use (subpixel) correct screen coordinates, at least it is easy to debug the code ( which gives us the order of vertices ). My fear is the lack of bounds for almost parallel edges from polygon and portal. This would still be a problem because I always round. At least these are the real y for Bresenham. I can detect ovefflow as with the screen borders..Error calculation is straight forward and I could just have a multi-edge inner loop (exception) which takes the minimum on every line and stores the result for portal cascade or BSP merging


				// divide by determinand = cross wedgeProduct .. where does this sum come from? Ah, this is just the normalization from the step above
				// PS: Why don't we need per vector normalization here like in gram schmidt?
				//     The wedge product propagates the length of both factors . Gramm Schmidt in 3d is just different. Perhaps it is due to the fact that we acually normalize there. For orthogonalize we would use the cross product only, which would get unstable if basis vectors drift to different lengths. But here, the length mean something and we don't iterate so the glitch would be single frame.

				// Old
				// invert flipped andere diagonale als transpos
				// off diagnoal elements negativ
				// To be compatible with vector methods this can be decomposed into
				// wedging per vector (as part of Matrix)  . New method for vector
				// Matrix multiplication using inner products: matrix of ros  *  Matrix of cols  . result with self => 0 . others det=wedgeProd

				//const bias=grad.mul_left_vec( new Vec2( [(item[0][0] as Vertex_OnScreen).position,(item[1][0] as Vertex_OnScreen).position] )  ) 
				// inner product pulls into the value coord-system. Weird: so matrix is of rows of field and pos are col of field "trans"
				// value=gradient &* xy  . invers


				//xy.nominator.forEach((n,i)=> xy.nominator[i].v[0] /=de )
			}

		}

	}

	is_edge_inside_corner(): number {
		//if (typeof )
		//Portal
		//I don't want to solve the rotation order of multiple cuts
		//It seems the easiest (shortest code, modest time) way? What precision?
		//So all edges already lost their depth at this point. (bias and cross should be rounded)
		//So even without pre clipping on the rectangle, I use screen coords (vertex culling (each vertex on each pyramid face) makes this work in 3d with vertices having negative z)
		//So really, how do I calculate the area of 3 edges cutting?
		//usually, I do wedge product (two vectors) in 2d and cross,inner with 3 vectors in 3d
		//Algebra? So the cuts are: bias.sum()+ [coefs 2x2] &* [x,y]  solve for  [x,y]
		// => [xy] = swapped &* bias  /  (det==wedge product)
		// So from these points I gather two vectors and calculate cross product finally.
		// for point->vectors and for cross(*-*) I need to subtract, so a common denominator: a*b * b*c * c*a 
		// nominator doubles the muls +1 in cross. Priorr they are bias*swapped*extent^2
		// 9 = 1+ 2 *(4)
		// 9 - 5 = 4   -- uh, if I add units ( like metres ) to xy
		// actually, the coefs (swapped or not) are 1/metres.
		//  2 *  (m^(-1) * m^2) = m^2
		// so even after this check: A lot of multiplication!!!
		// I scribbled some images regarding DMZ. So first I round all crossings to pixel coordinates
		// But then there are a lot of ways how the deges can pass from one DMZ ( the square rigth below of floored pixel coord) to another DMZ
		// Lot's of ways to create bugs. I always pixture special cases, but thanks to rounding, I don't even know rotation order.
		// Instead of getting crazy with DMZ rules, and considering that I need pair-wise cuts rounded to pixel coords,
		// I can calculate the area using pixel coords. If it is small: test each pixel ( raytracing is my base => no problem with rounding )
		// So only slithers are a problem? So not actually take the area? All cuts within a rectangle between all rays is still an interesting case.
		// for the other: Check if we even need to decide by multiply all combinations of pixels around DMZ -- haha. Number of executed operations are back at full float.
		// 16 bit rounded cuts (compatible vertex on screen, also the result of DIV) with epsilon = max( width, height ). I need this cuts for the rasterizer. As seen above 16x16 is enough
		// with an area below epsilon, I could rasterize this as a triangle and store the result in the beamtree / portal so that there is a definitive portal.
		// this rasterizer has a fat inner loop: 3 edges at ones. bubble sort per line. Accepts the same payload and calls the same mapper.		
		return 0
	}
}