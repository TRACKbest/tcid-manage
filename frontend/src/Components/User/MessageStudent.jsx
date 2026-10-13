import React from 'react'
import ChatThread from '../ChatThread'

const MessageStudent = ({ teacher_id, student_id }) => (
  <ChatThread teacherId={teacher_id} studentId={student_id} viewer="student" />
)

export default MessageStudent
