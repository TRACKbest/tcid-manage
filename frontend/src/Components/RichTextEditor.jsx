import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

const editorModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ header: [1, 2, 3, false] }],
    ['blockquote', 'link'],
    ['clean'],
  ],
}

const editorFormats = ['bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'header', 'blockquote', 'link']

const RichTextEditor = ({ value, onChange, placeholder }) => (
  <ReactQuill
    theme="snow"
    value={value || ''}
    onChange={onChange}
    modules={editorModules}
    formats={editorFormats}
    placeholder={placeholder}
  />
)

export default RichTextEditor
