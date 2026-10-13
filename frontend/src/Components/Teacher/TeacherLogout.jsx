import React from 'react'

const TeacherLogout = () => {
    localStorage.removeItem('teacherLoginStatus')
    localStorage.removeItem('teacherId')
    localStorage.removeItem('studentLoginStatus')
    localStorage.removeItem('studentId')
    localStorage.removeItem('activeAccountType')
    window.location.href='/teacher-login';
  return (
    <div>
      
    </div>
  )
}

export default TeacherLogout
