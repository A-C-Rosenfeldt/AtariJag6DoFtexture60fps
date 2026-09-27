import { assert } from "chai";
import { Vec, Vec2, Vec3, CanvasObject, Edge2, Edge3 } from "./clipping.js"
import { BSPnode_line_Beam, Vertex_OnScreen } from "./BSP";

declare global {
	interface Array<T> {
		popFromTop(): T;

		// Source - https://stackoverflow.com/a/57913509
		// Posted by jcalz, modified by community. See post 'Timeline' for change history
		// Retrieved 2026-03-20, License - CC BY-SA 4.0
		map<U>(
			callbackfn: (value: T, index: number, array: T[]) => U,
			thisArg?: any
		): { [K in keyof this]: U };
		//map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): { [K in keyof this]: U } ; //U[];
	}
}



//   (vertex) <--edge--> (vertex)             														log:  draw them all in their position . Color : orange
// can be logged using the line method of canvas. It is a bit dirty because I know that that method uses a math line internally, like I do
// I need this as a return type later
class Edge_graph {
    verts : [Vertex_OnScreen,Vertex_OnScreen] 
        constructor(egb: Edge_graph){     
        this.verts=egb.verts;
    }
}
 // expand edge into line using implicit function: dual vector for inner products. "bra ket"				
 class Edge_graph_beam extends Edge_graph{    
    line: BSPnode_line_Beam  // aka : normal in context of a beam, but I want line for the 2d BSP code.
     constructor(egb: Edge_graph_beam){
        super(egb);
        this.line= new BSPnode_line_Beam([this.verts[0].v,this.verts[1].v ])
    }   
}

 /* cut back: edge intersection("cut") with borders . I need this for debugging. Make it real?			log:  color : blue for edge and borderCuts
 *  endcap -- edge --    // with endcap -> [ vertex |  cut ]*/
 class Edge extends Edge_graph_beam{    
    // Not the ends of the line. I think that I don't need them in the algorithm. Then I should not log them (yet). No phantasy data!
    // In the previous version of this code I tried to be clever with immutable, but here I try out plain old pointers
    ends : [Vertex_OnScreen,Vertex_OnScreen] 
    constructor(egb: Edge_graph_beam){
        super(egb);

        if (egb instanceof Edge)
            for(var i=0;i<this.ends.length;i++)
                this.ends[i]=egb.ends[i];
        
        // I need these for comparison. Or do I? The null check did not seem to fit the algorithm
        for(var i=0;i<this.ends.length;i++)
            this.ends[i]=egb.verts[i];
    }

    decide(unkown : Edge_graph_beam){
        // meet
        for (var j = 0; j < this.ends.length; j++) {
            for (var i = 0; i < this.ends.length; i++) {
                if (this.verts[i] == unkown.verts[j]) {
                    return   // object stays as it is
                }
            }
        }

        // cut
        var splitter:BSPnode_line_Beam = unkown.line
        const sides = [0, 0]
        for(var j=0;j<this.ends.length;j++){
            sides[j]=splitter.decide(this.ends[j])
        }
        if ((sides[0] > 0) == (sides[1] > 0)) return

        var cross = this.line.normal3d.crossProduct(splitter.normal3d)
        var v=new Vertex_OnScreen(cross)

        var child:[Edge,Edge]
        for (var i = 0; i < this.ends.length; i++) {
            child[i]=new Edge(this)
            child[i].ends[1-i]=v
        }        
    }
 }
 /* 											vertex will be compared by reference ( in a mesh or even a simple polygon), while cuts belong to the current edge
 * 								endcaps and cuts like vertices are "bra" vectors  ( not dual )    We can use inner product to find out on which side of an edge "ket" they lie
 *  log:  wedge product: to draw parallels to depict the process how we instert the edge into the tree going down the nodes
 *  log cuts .. so actually I do not care about lines or edges here. Even with regards to the color: colorize the endcaps to designate the type
 *  log inserts: Though I care for the final insert as node into the tree. BSP nodes refer to lines (not edges). So the insert should be blue.
 *  The line segment lives on the edge. I could draw it in a second window . Like if I do this all to remove hidden surfaces in vectors graphics without filling the faces.
 */

/*
Insert Face. Two panels in a row below the two edge panels.
I can fill a face in the log very translucent, I can just "redraw" the outline
face recognizes its edges. But would I not show insertion from root? Mark the node.lines that I touch.
Line where polygon falls on one side: grey
Line which meets the polygon  aka  the both belong to same edge: yellow   with endCaps drawn as points . Showing the re-collection of segments which had been split by other lines -- same which split the polygon..
Line which cuts through the polygon: red
    Splits internally to the polygon: For example if we started with small polygon in front. And it has many edges. And its BSP eats some of them with only two going outside.
    so it would be interesting to see red  edges (from the tree; not necessarily from the polygon) inside a polygon which has far less cut edges
*/