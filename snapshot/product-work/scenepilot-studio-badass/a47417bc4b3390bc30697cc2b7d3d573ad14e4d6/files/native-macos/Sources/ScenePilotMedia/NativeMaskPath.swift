import CoreGraphics
import CoreImage
import ScenePilotCore

public enum NativeMaskPath {
    /// Shared cubic geometry for the native path editor and final frame rendering.
    public static func path(_ mask: ClipMask, size: CGSize) -> CGPath {
        let path = CGMutablePath()
        guard let points = mask.points, let first = points.first else { return path }
        func point(_ p: MaskPoint) -> CGPoint { CGPoint(x: (mask.x + (p.x-0.5)*mask.width)*size.width, y: (1-mask.y-(p.y-0.5)*mask.height)*size.height) }
        path.move(to: point(first.anchor))
        for i in points.indices {
            let a = points[i], b = points[(i+1)%points.count]
            path.addCurve(to: point(b.anchor), control1: point(a.outgoing), control2: point(b.incoming))
        }
        path.closeSubpath(); return path
    }
    static func image(_ mask: ClipMask, bounds: CGRect) throws -> CIImage {
        // Feather padding includes off-canvas path coverage. One-channel raster keeps
        // allocation bounded even at 8K, and is released with the frame's CI graph.
        let padding = Int(ceil(mask.feather*4))+2
        let width = Int(bounds.width)+padding*2, height = Int(bounds.height)+padding*2
        guard width > 0, height > 0, width*height <= 90_000_000,
              let context = CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width,space:CGColorSpaceCreateDeviceGray(),bitmapInfo:CGImageAlphaInfo.none.rawValue) else {
            throw ProjectError.invalid("Cannot allocate native Bezier mask coverage.")
        }
        context.setFillColor(gray:0,alpha:1); context.fill(CGRect(x:0,y:0,width:width,height:height))
        context.translateBy(x:CGFloat(padding),y:CGFloat(padding)); context.setFillColor(gray:1,alpha:1)
        context.addPath(path(mask,size:bounds.size)); context.drawPath(using:.eoFill)
        guard let image = context.makeImage() else { throw ProjectError.invalid("Cannot rasterize native Bezier mask.") }
        return CIImage(cgImage:image,options:[.colorSpace:NSNull()]).transformed(by:CGAffineTransform(translationX:-CGFloat(padding),y:-CGFloat(padding)))
            .composited(over:CIImage(color:.black))
    }
}

/// Render-queue confined, bounded LRU. Static paths do not rasterize on every frame.
final class NativeMaskCache {
    private struct Entry { let mask:ClipMask; let bounds:CGRect; let image:CIImage; let bytes:Int }
    private var entries:[Entry] = []
    private(set) var byteCount = 0
    private(set) var rasterizations = 0
    let budget:Int
    init(budget:Int = 32*1024*1024) { self.budget = max(0,budget) }
    func image(_ mask:ClipMask,bounds:CGRect) throws -> CIImage {
        guard mask.shape == .bezier else { return try NativeSceneRenderer.maskImage(mask,bounds:bounds) }
        if let i = entries.firstIndex(where: { $0.mask == mask && $0.bounds == bounds }) { let entry = entries.remove(at:i); entries.append(entry); return entry.image }
        let image = try NativeSceneRenderer.maskImage(mask,bounds:bounds); rasterizations += 1
        let padding = Int(ceil(mask.feather*4))+2, bytes = (Int(bounds.width)+padding*2)*(Int(bounds.height)+padding*2)
        if bytes <= budget {
            while !entries.isEmpty && (entries.count >= 16 || byteCount+bytes > budget) { byteCount -= entries.removeFirst().bytes }
            entries.append(Entry(mask:mask,bounds:bounds,image:image,bytes:bytes)); byteCount += bytes
        }
        return image
    }
}
