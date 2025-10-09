import './page.tsx' 
import {Collection,Version,Doc,ChunkTextRow,ChunkMeta,Chunk,ChunkWithVector} from '../../../share/type.ts'

const CollectionContainer = (collectionInfo : Collection) => {
    return (
        <div className="collection-container">
            <h2>Collection: {collectionInfo.name}</h2>
            <p>Description: {collectionInfo.description}</p>
            <p>Created At: {new Date(collectionInfo.created_at).toLocaleString()}</p>
            <p>collected id : {collectionInfo.collectionId}</p>
        </div>
    )
}
