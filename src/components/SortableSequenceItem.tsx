"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGripVertical, faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Sequence } from "@/api/services/poolsService";

interface SortableSequenceItemProps {
  sequence: Sequence;
  onEdit: (sequence: Sequence) => void;
  onDelete: (sequenceId: number) => void;
  isDeleting?: boolean;
  isReordering?: boolean;
}

export default function SortableSequenceItem({
  sequence,
  onEdit,
  onDelete,
  isDeleting = false,
  isReordering = false
}: SortableSequenceItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sequence.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow duration-200 ${
        isDragging ? 'shadow-lg' : ''
      } ${isReordering ? 'opacity-75' : ''}`}
    >
      <div className="grid grid-cols-12 gap-4 items-center">
        {/* Draggable area - 8 out of 12 columns */}
        <div
          className="col-span-8 flex items-center space-x-4 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <FontAwesomeIcon icon={faGripVertical} className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              {sequence.position}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 font-poppins">
                {sequence.name}
              </h4>
              <p className={`text-sm font-poppins ${
                   'text-green-600'

              }`}>
                {sequence.video_count} Videos
              </p>
              {sequence.content_type && sequence.content_type.length > 0 && (
                <p className="text-xs text-gray-500 font-poppins">
                  Content: {sequence.content_type.map(type =>
                    type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                  ).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Button area - 4 out of 12 columns */}
        <div className="col-span-4 flex items-center justify-end space-x-2">
          <button
            onClick={() => onEdit(sequence)}
            className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-colors duration-200"
          >
            <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(sequence.id)}
            disabled={isDeleting}
            className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-200 transition-colors duration-200 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
