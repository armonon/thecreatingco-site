import Clipper from './vendor/clipper.esm.js';
const SCALE=1000;
function strokePaths(stroke){
 const path=stroke.points.map(p=>({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)}));
 const closed=path.length>=3&&Math.hypot(path[0].X-path.at(-1).X,path[0].Y-path.at(-1).Y)<1.5*SCALE;
 if((stroke.kind==='fill'||stroke.kind==='cut'&&closed)&&path.length>=3){
  const filled=Clipper.Clipper.SimplifyPolygon(path,Clipper.PolyFillType.pftEvenOdd);
  if(filled.length)return filled;
 }
 const offset=new Clipper.ClipperOffset(2,.06*SCALE),paths=[];
 const clean=path.filter((p,i)=>!i||p.X!==path[i-1].X||p.Y!==path[i-1].Y);
 if(clean.length<2)return [];
 offset.AddPath(clean,Clipper.JoinType.jtRound,closed?Clipper.EndType.etClosedLine:Clipper.EndType.etOpenRound);
 offset.Execute(paths,stroke.width*SCALE/2);
 return paths;
}
export function contours(strokes){
 let paths=[],tree=new Clipper.PolyTree();
 for(const stroke of strokes){
  if(stroke.points.length<2)continue;
  const addition=strokePaths(stroke);
  if(!addition.length)continue;
  const clip=new Clipper.Clipper();clip.StrictlySimple=true;
  clip.AddPaths(paths,Clipper.PolyType.ptSubject,true);
  clip.AddPaths(addition,stroke.kind==='cut'?Clipper.PolyType.ptClip:Clipper.PolyType.ptSubject,true);
  tree=new Clipper.PolyTree();
  clip.Execute(stroke.kind==='cut'?Clipper.ClipType.ctDifference:Clipper.ClipType.ctUnion,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
  paths=Clipper.Clipper.ClosedPathsFromPolyTree(tree);
 }
 const result=[];
 function visit(node){
  for(const child of node.Childs()){
   if(!child.IsHole())result.push({outline:child.Contour().map(p=>({x:p.X/SCALE,y:p.Y/SCALE})),holes:child.Childs().filter(n=>n.IsHole()).map(n=>n.Contour().map(p=>({x:p.X/SCALE,y:p.Y/SCALE})))});
   visit(child);
  }
 }
 visit(tree);return result;
}
