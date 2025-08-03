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
      {...attributes}
      {...listeners}
      className={`bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-grab active:cursor-grabbing ${
        isDragging ? 'shadow-lg' : ''
      } ${isReordering ? 'opacity-75' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <FontAwesomeIcon icon={faGripVertical} className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              {sequence.position}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 font-poppins">
                {sequence.name || `Sequence ${sequence.position}`}
              </h4>
              <p className={`text-sm font-poppins ${
                sequence.videos_count >= sequence.video_count
                  ? 'text-green-600'
                  : sequence.videos_count > 0
                    ? 'text-orange-600'
                    : 'text-gray-600'
              }`}>
                {sequence.videos_count} / {sequence.video_count} Videos
                {sequence.videos_count >= sequence.video_count && (
                  <span className="ml-1">✓</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(sequence);
            }}
            className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-colors duration-200"
          >
            <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(sequence.id);
            }}
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
