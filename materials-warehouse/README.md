# Web app quản lý xuất kho vật tư

App này là bản nhập liệu chạy trên trình duyệt cho công nhân dùng điện thoại hoặc máy tính. Màn hình chính cho phép nhập nhiều dòng vật tư trong cùng một phiếu, ký tên trên canvas, chụp tối đa 3 ảnh, khóa ngoài giờ 07:30-16:30 và xuất dữ liệu.

## Chạy thử

Mở file `index.html` bằng trình duyệt.

Khi triển khai cho công nhân quét QR/NFC, nên đưa thư mục này lên một URL nội bộ, GitHub Pages, Netlify, hoặc web server công ty. QR code và thẻ NFC chỉ cần trỏ đến URL đó.

## Nạp cơ sở dữ liệu mã CCDC

Trong khung `CSDL CCDC`, chọn file Excel hoặc CSV kế toán gửi.

File cần có các cột tương đương:

- `Mã vật tư` hoặc `Mã CCDC`
- `Tên vật tư` hoặc `Tên CCDC`
- `Đơn vị tính` hoặc `ĐVT`

Sau khi nạp, dữ liệu được lưu trong trình duyệt. Công nhân gõ mã như `CLKH0089` hoặc gõ chuỗi tên như `bạc đạn`, app sẽ lọc theo mã và tên. Nếu không có kết quả, app hiện lựa chọn `Chưa có mã vật tư`.

## Lưu dữ liệu

App có 3 cách lưu/xuất:

- Lưu cục bộ trong trình duyệt bằng `localStorage`.
- Xuất `CSV` để mở bằng Excel.
- Xuất `JSON` đầy đủ, gồm cả chữ ký và ảnh dạng dữ liệu ảnh.

Với vận hành thật, nên dùng Google Sheet + Google Drive:

1. Tạo một Google Sheet nhận dữ liệu.
2. Tạo một thư mục Google Drive để lưu chữ ký và ảnh.
3. Mở Apps Script, dán nội dung file `google-apps-script.gs`.
4. Thay `SPREADSHEET_ID` bằng ID của Google Sheet.
5. Thay `DRIVE_FOLDER_ID` bằng ID thư mục Drive.
6. Deploy Apps Script dạng `Web app`.
7. Copy URL deploy vào ô `Google Apps Script URL` trong app rồi bấm `Lưu URL`.

URL đúng phải có dạng:

```text
https://script.google.com/macros/s/AKfycb.../exec
```

Không dán link chỉnh sửa Apps Script dạng:

```text
https://script.google.com/home/projects/.../edit
```

Apps Script sẽ ghi mỗi dòng vật tư thành một dòng trong Sheet. Nếu một phiếu có 5 vật tư thì Sheet có 5 dòng, các thông tin chung được lặp lại, chữ ký và 3 ảnh là link Google Drive.

Khi quản lý bấm `Hủy` một phiếu, app không xóa dữ liệu vật tư. Phiếu sẽ được đánh dấu `Đã hủy` và gửi lại lên Google Sheet với các cột:

- `trang_thai_phieu`
- `cancelled_at`
- `cancelled_by`
- `cancel_reason`

Sau khi sửa file `google-apps-script.gs`, cần vào Apps Script và deploy lại phiên bản Web app mới để Google Sheet nhận các cột hủy này.

Khi quản lý bấm `Xóa vĩnh viễn`, app sẽ gửi lệnh xóa các dòng có cùng `record_id` trên Google Sheet và đưa ảnh/chữ ký tương ứng trên Google Drive vào thùng rác. Đây là thao tác khác với `Hủy`: dữ liệu phiếu sẽ không còn trong danh sách để truy vết.

## Khóa nhập

App tự khóa nhập ngoài khung giờ 07:30-16:30 theo giờ thiết bị. Mã quản lý mặc định là `2468`; vào phần `Khóa nhập` để mở khóa khẩn cấp hoặc đổi mã.

Các phần `CSDL CCDC`, `Đồng bộ`, `Khóa nhập`, `Phiếu gần đây` mặc định bị ẩn và chỉ hiện sau khi bấm `Admin` rồi nhập đúng mã quản lý.

Lưu ý quan trọng: bản tĩnh này ưu tiên nhập nhanh, không có đăng nhập phức tạp. Mã quản lý phía trình duyệt chỉ đủ cho kiểm soát thao tác thông thường. Nếu cần đăng nhập bằng Google account admin thật hoặc chống sửa/hủy nghiêm ngặt, nên chuyển phần kiểm tra quyền quản lý và khóa ngày sang Apps Script/Firebase/backend riêng.

## Khóa dữ liệu ngày cũ

Người dùng thường chỉ tạo phiếu mới khi app đang mở giờ làm việc. Danh sách phiếu đã ghi không cho sửa/hủy nếu chưa mở mã quản lý. Khi mở mã quản lý, có thể sửa phiếu chưa hủy hoặc hủy phiếu trong thời gian được cấp. Phiếu đã hủy không bị xóa khỏi dữ liệu để còn truy vết.
