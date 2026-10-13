import React from 'react'
import ChatThread from './ChatThread'

const Message = ({ teacher_id, student_id }) => (
  <ChatThread teacherId={teacher_id} studentId={student_id} viewer="teacher" />
)

export default Message