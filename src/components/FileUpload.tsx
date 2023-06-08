import { useState } from "react";
import { CollectionMetadata } from "@/utils/utils";
export default function FileUpload({ className, setCollectionId, setCollectionName, collectionMetadata }:
    { className?: string, setCollectionId: (collectionId: string) => void, setCollectionName: (collectionName: string) => void, collectionMetadata: CollectionMetadata }) {
    const [file, setFile] = useState<File | null>(null);
    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files ? e.target.files[0] : null);
    };
    const onFileUpload = async () => {
        if (!file) return;
        setCollectionName(file.name);
        const formData = new FormData();
        formData.append("file", file);
        collectionMetadata["name"] = file.name;
        formData.append("collectionMetadata", JSON.stringify(collectionMetadata))
        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });
        const data = await res.json() as {collectionId: string};
        setCollectionId(data.collectionId);
        console.log(data);
    };
    return (
        <div className={className}>
            <div className="flex flex-row items-center space-x-2">
                <input type="file" onChange={onFileChange} className="file-input file-input-bordered file-input-xs w-full max-w-xs" />
                <button onClick={onFileUpload} className="btn">submit</button>
            </div>
        </div>
    );
}