import { assert } from "chai";
import { Vec, Vec2, Vec3, CanvasObject, Edge2, Edge3, LogParallelLines, CanvasHelper } from "./clipping.js"
import { BSPnode_line_Beam, Polygon, Vertex_OnScreen } from "./BSP.js";

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


// expand edge into line using implicit function: dual vector for inner products. "bra ket"				
class Edge_beam extends Edge3 {
    line: BSPnode_line_Beam  // aka : normal in context of a beam, but I want line for the 2d BSP code.
    constructor(egb: Edge3 | Vec3[], marker?: string, l?: LogParallelLines) {     //  ? means optional here. So I guess it is not about null ( like in C# with all the ? ), but about 'undefined'
        if (egb instanceof Edge3) // If I ever go back to optional parameter: truely ?  Because I don't understand null vs typeof( egb )!='undefined' and ? seems to kinda gloss over it
            super(egb.vs, (typeof marker == 'undefined') ? "#bbb" : marker, l)  // null is fed through to actively block drawing, while undefined leads to default actions
        else //if ( typeof(egb) == typeof([Vertex_OnScreen,Vertex_OnScreen]))  // string comparison !? runtime !! Compiler does not need it
            super(egb)    // but why does this even compile?

        this.line = new BSPnode_line_Beam(this.vs)
    }
}

type Children = [Edge_with_children, Edge_with_children];

/* cut back: edge intersection("cut") with borders . I need this for debugging. Make it real?			log:  color : blue for edge and borderCuts
*  endcap -- edge --    // with endcap -> [ vertex |  cut ]*/
class Edge_with_children extends Edge_beam {
    // Not the ends of the line. I think that I don't need them in the algorithm. Then I should not log them (yet). No phantasy data!
    // In the previous version of this code I tried to be clever with immutable, but here I try out plain old pointers
    ends: Vec3[]
    log_para: number  // number of parellel lines drawn in the graphical log
    child: Children = [null, null];
    constructor(egb: Edge_beam, l?: LogParallelLines) {
        super(egb, null, l);

        //this.ends = new Array<Vec3>(2)
        // So , I could no decide between tupels and some vector magic at first. TODO slice
        if (egb instanceof Edge_with_children) {
            this.log_para = egb.log_para + 1
            //for(var i=0;i<this.ends.length;i++)
            this.ends = egb.ends.slice();
        } else {
            this.log_para = 1  // I want to try display in same canvas as asset loader xor final display
            //for(var i=0;i<this.ends.length;i++)
            this.ends = egb.vs.slice();
        }

        // I need these for comparison. Or do I? The null check did not seem to fit the algorithm
        //for(var i=0;i<this.ends.length;i++)
        this.vs = egb.vs.slice();
    }

    // tree
    reach(prior: Edge_with_children) {
        var children = this.decide(prior)

        children.forEach((child, i) => {
            if (child == null) return
            var p = prior.child[i]
            if (p == null) {  // todo: this code for root also? Same "if", but different reference?
                prior.child[i] = child
            } else {
                child.reach(p)
            }
        })
    }

    // math
    private decide(prior: Edge_beam): Children {
        var child: Children = [null, null]
        for (var j = 0; j < prior.vs.length; j++) {
            for (var i = 0; i < this.vs.length; i++) {
                if (this.vs[i] == prior.vs[j]) { // only one vertex should be shared. Otherwise I would have a dupe edge. Todo: check
                    const side = Math.min(1, 1 + Math.sign(prior.line.normal3d.innerProduct(this.vs[1 - i])))
                    child[side] = this; // this looks weird todo "admit themselves to the hospital"
                    return child
                }
            }
        }

        // cut
        var splitter = prior.line.normal3d
        const sides = [0, 0]

        for (var j = 0; j < this.ends.length; j++) {
            sides[j] = splitter.innerProduct(this.vs[j]) // splitter.decide(this.ends[j])
        }
        const s0 = sides[0] > 0;
        if (s0 == (sides[1] > 0)) {
            const side = s0 ? 1 : 0
            child[side] = this; // this looks weird todo "admit themselves to the hospital"
            return child
        }

        var l = new LogParallelLines()
        l.log_para = this.log_para  // pixels are small. Debugging steps are not smaller. Advance always. I don't like ticks, I mean aggressive rounding to make things look going step by step (easy)
        l.normal = this.line.normal3d

        var cross = this.line.normal3d.crossProduct(splitter, l)  // this should log at para=1 ( odd/even)

        //var v=new Vertex_OnScreen(cross) // logging

        for (var i = 0; i < this.ends.length; i++) {  // the magic of pointers
            const c = new Edge_with_children(this) //, l)   // the original vertices are still one member acces operation . away // todo: why nothing on canvas
            c.ends[1 - i] = cross   // but the ends point to the correct object
            c.toCanvas(null,l)
            child[i] = c;
        }

        return child
    }

    toCanvas(marker:string=null, l?:LogParallelLines):void{ let ctx=CanvasObject.ctx //ctx: CanvasRenderingContext2D): void {
        const coords = this.ends.map(v=>CanvasHelper.log_view(v.v  , l));  // CanvasObject
        if (marker==null){
            var marker= "rgb(" 
            for (let i = 0; i < 3; i++) marker += (Math.round((Math.random() * 200)) + 55).toFixed(0) + " "  
            marker+=")";//"#" + cst + "2")  //??"#8e8"
        }
        super.toCanvasInner(coords,marker,l);
    }	    
}

export class BSPtreeLog {
    root: Edge_with_children = null  // isn't it 'undefined' otherwise?
    insertPolygonEdgeByEdge(p: Polygon, ID: number) {

        //const n = new BSPnode_perInsert(ID)
        p.es.forEach(e => {
            //let en = new BSPnode_edge(e)   not compatible with 3d math
            const b = new Edge_beam(e)
            const n = new Edge_with_children(b) // Node_CreateFromVecs(e, ID);

            // So I thought about DontRepeatYourself, but found no easy way out. This is a rather generic null check. I do it on root an leaf. Root is just different ( see properties ). The first edge loaded needs to go somewhere. I need an object in the loader: the tree.
            //  Yeah, C-strings are just a pointer to the first char, but we moved on to C++ and Rust. It is like this nasty default initialisation of properties. It is still KISS!
            if (this.root == null) {
                this.root = n
            }
            else {
                // reversed from collection notion (see signature above) because this.root is just the start of a chain of nodes glossed over.
                var child = n.reach(this.root)//, "rgba(0, 156, 204, 0.57)", false) // TODO check that the new vertices due to cuts are shown. Perhaps use the new types.

            }
        })
    }
}

/*
* 								
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