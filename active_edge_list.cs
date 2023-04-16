// I can easily read C# and it still translates straight forward to JRISC .. I 

// for architecture and my final renderer I want to use trees everywhere,
// but for "Fight For Life" and "battle sphere" : no slithers, sparse distribution of triangels ( not even a spike like in a first person racing game)
// There is a middle ground: Active edge list:
// We have 2 fighters * (3 = body + arms + legs) * 3 segments * 4 sides = 9 * 8 = 72 polygons. Super Mario 64 has 100 polygons. After back face culling we sure have max 256 polygons on screen.


void main(){
	List<vertex> world, 
	transformed_vertices;
}

class Triangle{
	List<uint8> IndexToVertex; // index instead of pointer to save memory
}

struct sort_item{
	uint8 y;
	uint8 IndexToVertex;
}

class GPU{
// There is a similar amount of vertices .. so about on or three ( yeah it is bunching a bit ) per scanline
void sort(){
		List.Sort(transformed_vertices, vertex=>vertex[1] ); // sort by scanline. Needs about 8 passes ( 2^8=256 ). List and algorithm fit into SRAM. Merge Sort / heap sort can use the register efficiently.

		foreach(){
			sort16();
		}
	}

	void sort16(){
		// I am biased towards mergeSort. But here we can Load a
		//for
		//for // for
		CMP();
		Store(); // wait for carry flat
		Load( sort_item[2] ); // branch delay slot
		if (negative){
			swap();
		}
		// for
		store();
	}

	void render(){
		tranform();
		culling();
		remove_useless_vertices();

		find_softmax_width(); // todo: tune on recorded gameplay for best worst-case

		sort(vertex_to_edge v=> v.x); // first filter ( list coopy within SRAM)
		while(any_triangle_left){
			sweep_over_x(softmax_width); // left vertex of any polygon
			remove_fully_drawn_colums();
		
			sort(vertex_to_edge v=> v.y);
			while(any_triangle_in_this_chunck){	
				if (y<this.y) restore(active_edgelist);
				while (y<this.y) sweep_over_y(); // gap
				do{		
					sweep_over_y(); // top vertex of filtered polygons
					if (front_facing){
						set_up_shader();
						foreach(scanline){
							next_scanline(); // clipping by other triangles in front of this
							Xspan spans=activeList.map( edge -> xspan);
							sort(spans.flat());
							foreach(span in spans){
								draw();
								if (check_z()) skip();
							}
							if (y>=next_polygon.top.y) backup(active_edgelist);
						}
				}
			}(bottom_vertex.has(Triangle below)); // even here: need to reevaluate all x_span rejections
			}
		}
	}

	uint[256,6] vertex_to_edge; // check models on load (run time) and use max value for second dimension

	int[2] XSpan{
		get{
			return new int[]{0,0}; // max span for the rest ( bottom ) of current triangle
			// though the fast mul instruction tells me to check span overlap in current line and the use 
		}
	}

	uint y;
	// A bit similar to Dooms Visiplane going left to right and checking the covered range, with active edge list and the strong horizontel predicment of the blitter, we go top down and check for vertices.
	void next_scanline(){
		while(vertex.y =this.y){
			active_triangles.Where( index= edge.index[0 or 1] ){remove from list}
			triangles.Where( index= edge.index[0 or 1] && Triangle.xspan.overlap_with(this.XSpan )){add to list} // vertices need an index to edges
			// I read that for a mesh, the edges should point to the faces and the vertices. I need bi-directional links, but can still go over the edge
			// This structure helps to avoid lists of list. I think each edge has one pointer to the next edge around the face and one pointer to the next edge around a vertex
			// Each vertex and face has one pointer to an edge
			vertex.next();
		}
	}
	bool check_Z(Triangle that){
		if (this.z < that.z) active_triangles.remove(that) ;return false; // no intersecting polygons allowed. Use bone animation in blender3d instead!
		return true;
	}
}



// An occlusion algorithm may need to check all other polygons. Now this could happen per pixel .. that would be too slower and the z-buffer is the solution which is independant of the number of polygons.